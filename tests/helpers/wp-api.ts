import { request, type APIRequestContext } from '@playwright/test';
import path from 'path';
import { mkdirSync } from 'fs';

type PagePayload = {
  slug: string;
  title: string;
  content: string;
  status?: 'publish' | 'draft' | 'private';
};

type InstallPayload = {
  siteTitle: string;
  username: string;
  password: string;
  email: string;
};

export class WordPressApiBase {
  protected readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  protected buildRestEndpoint(root: string, route: string): string {
    const normalizedRoute = `/${route.replace(/^\/+/, '')}`;
    const url = new URL(root, `${this.baseUrl}/`);

    if (url.searchParams.has('rest_route')) {
      url.searchParams.set('rest_route', normalizedRoute);
      return url.toString();
    }

    url.pathname = `${url.pathname.replace(/\/+$/, '')}${normalizedRoute}`;
    url.search = '';
    return url.toString();
  }

  protected getCandidateRestRoots(primaryRoot: string): string[] {
    const fallbackRoots = [
      `${this.baseUrl}/wp-json/`,
      `${this.baseUrl}/index.php?rest_route=/`,
      `${this.baseUrl}/?rest_route=/`,
    ];

    const normalizedPrimary = primaryRoot
      ? (primaryRoot.startsWith('http')
          ? primaryRoot
          : new URL(primaryRoot, `${this.baseUrl}/`).toString())
      : '';

    return [...new Set([normalizedPrimary, ...fallbackRoots].filter(Boolean))];
  }
}

/**
 * REST API client for WordPress - all operations via API, no browser needed
 */
export class WordPressRestClient extends WordPressApiBase {
  private api: APIRequestContext | null = null;
  private ownsApi: boolean = false;
  private currentUser: string | null = null;

  constructor(baseUrl: string, apiContext?: APIRequestContext) {
    super(baseUrl);
    this.api = apiContext || null;
    this.ownsApi = !apiContext;
  }

  private getAuthStoragePath(username: string): string {
    return path.join(process.cwd(), 'tests', '.auth', `${username}-auth.json`);
  }

  private async ensureAuthenticatedAdminSession(): Promise<void> {
    const api = this.getApi();
    const response = await api.get('/wp-admin/', { failOnStatusCode: false });
    const html = await response.text();
    if (response.url().includes('/wp-admin/install.php') || html.includes('id="setup"')) {
      throw new Error('WordPress is not installed yet. Run ensureInstalled() before authentication.');
    }
    const redirectedToLogin = response.url().includes('/wp-login.php') || html.includes('id="loginform"');
    if (redirectedToLogin) {
      throw new Error('WordPress authentication failed: /wp-admin/ resolved to login page.');
    }
  }

  async ensureInstalled(payload: InstallPayload): Promise<void> {
    const api = this.getApi();

    const adminResponse = await api.get('/wp-admin/', { failOnStatusCode: false });
    const adminHtml = await adminResponse.text();
    const installNeeded =
      adminResponse.url().includes('/wp-admin/install.php') ||
      adminHtml.includes('id="setup"') ||
      adminHtml.includes('WordPress &rsaquo; Installation');

    if (!installNeeded) {
      return;
    }

    // Step through installer entirely via HTTP form submissions.
    await api.get('/wp-admin/install.php?step=1', { failOnStatusCode: false });
    const installResponse = await api.post('/wp-admin/install.php?step=2', {
      form: {
        weblog_title: payload.siteTitle,
        user_name: payload.username,
        admin_password: payload.password,
        admin_password2: payload.password,
        admin_email: payload.email,
        blog_public: '0',
        Submit: 'Install WordPress',
        pw_weak: '1',
        language: 'en_US',
      },
      failOnStatusCode: false,
    });

    const body = await installResponse.text();
    const success = body.includes('Success!') || body.includes('WordPress has been installed');
    if (!success) {
      throw new Error(`WordPress installation failed with status ${installResponse.status()}.`);
    }
  }

  async init(username: string, password: string): Promise<void> {
    if (this.api && !this.ownsApi) {
      // If using a provided context, just verify we can access it
      this.currentUser = username;
      return;
    }

    this.api = await request.newContext({
      baseURL: this.baseUrl,
      ignoreHTTPSErrors: true,
    });

    // First, visit login page to establish session
    await this.api.get('/wp-login.php', { failOnStatusCode: false });

    // Perform login
    const loginResponse = await this.api.post('/wp-login.php', {
      form: {
        log: username,
        pwd: password,
        rememberme: 'forever',
        'wp-submit': 'Log In',
        redirect_to: `${this.baseUrl}/wp-admin/`,
        testcookie: '1',
      },
      failOnStatusCode: false,
    });

    // Login responses may be 200 or 302. Both can be valid - the important part
    // is that cookies are set for subsequent requests.
    const statusCode = loginResponse.status();
    if (statusCode >= 400) {
      throw new Error(`WordPress API login failed with status ${statusCode}`);
    }

    this.currentUser = username;
  }

  async initFromAuthStorage(username: string): Promise<void> {
    this.api = await request.newContext({
      baseURL: this.baseUrl,
      ignoreHTTPSErrors: true,
      storageState: this.getAuthStoragePath(username),
    });

    this.ownsApi = true;
    this.currentUser = username;
    await this.ensureAuthenticatedAdminSession();
  }

  async saveAuthStorage(username?: string): Promise<string> {
    const user = username || this.currentUser;
    if (!user) {
      throw new Error('No username available to save auth storage.');
    }

    const api = this.getApi();
    const authPath = this.getAuthStoragePath(user);
    mkdirSync(path.dirname(authPath), { recursive: true });
    await api.storageState({ path: authPath });
    return authPath;
  }

  async dispose(): Promise<void> {
    if (this.api && this.ownsApi) {
      await this.api.dispose();
    }
    this.api = null;
  }

  private getApi(): APIRequestContext {
    if (!this.api) {
      throw new Error('API not initialized. Call init() first or pass APIRequestContext to constructor.');
    }
    return this.api;
  }

  async getRestBootstrap(): Promise<{ candidateRoots: string[]; nonce: string }> {
    const api = this.getApi();
    
    // Try to get nonce from an authenticated admin endpoint
    const response = await api.get('/wp-admin/', { failOnStatusCode: false });
    const html = await response.text();

    // Extract REST root from HTML
    const rootMatch = html.match(/"rest_root":"([^"]+)"/);
    const nonceMatch = html.match(/"nonce":"([^"]+)"/);

    if (!nonceMatch) {
      throw new Error('Unable to extract nonce from wp-admin. WordPress may not be installed or user not authenticated.');
    }

    const root = rootMatch ? rootMatch[1].replace(/\\\//g, '/') : '';
    const nonce = nonceMatch[1];

    return {
      candidateRoots: this.getCandidateRestRoots(root),
      nonce,
    };
  }

  async activatePlugin(pluginSlug: string): Promise<void> {
    const api = this.getApi();
    const { candidateRoots, nonce } = await this.getRestBootstrap();
    const errors: string[] = [];

    for (const root of candidateRoots) {
      const endpoint = new URL(
        this.buildRestEndpoint(root, `wp/v2/plugins/${pluginSlug}`)
      );

      const putResponse = await api.put(endpoint.toString(), {
        headers: {
          'X-WP-Nonce': nonce,
          'Content-Type': 'application/json',
        },
        data: {
          status: 'active',
        },
        failOnStatusCode: false,
      });

      if (putResponse.ok()) {
        return;
      }

      // Some Apache/PHP setups disallow PUT. Retry with POST override.
      const postOverrideResponse = await api.post(endpoint.toString(), {
        headers: {
          'X-WP-Nonce': nonce,
          'X-HTTP-Method-Override': 'PUT',
          'Content-Type': 'application/json',
        },
        data: {
          status: 'active',
        },
        failOnStatusCode: false,
      });

      if (postOverrideResponse.ok()) {
        return;
      }

      errors.push(`activate ${root} -> PUT ${putResponse.status()} / POST-override ${postOverrideResponse.status()}`);
    }

    throw new Error(
      `Failed to activate plugin ${pluginSlug}. Tried roots: ${candidateRoots.join(', ')}. Errors: ${errors.join('; ')}`
    );
  }

  async updateOption(optionName: string, optionValue: unknown): Promise<void> {
    const api = this.getApi();
    const { candidateRoots, nonce } = await this.getRestBootstrap();
    const errors: string[] = [];

    for (const root of candidateRoots) {
      const endpoint = new URL(
        this.buildRestEndpoint(root, `wp/v2/settings`)
      );

      const response = await api.post(endpoint.toString(), {
        headers: {
          'X-WP-Nonce': nonce,
          'Content-Type': 'application/json',
        },
        data: {
          [optionName]: optionValue,
        },
        failOnStatusCode: false,
      });

      if (response.ok()) {
        return;
      }

      errors.push(`update ${root} -> ${response.status()}`);
    }

    throw new Error(
      `Failed to update option ${optionName}. Tried roots: ${candidateRoots.join(', ')}. Errors: ${errors.join('; ')}`
    );
  }

  async getOption(optionName: string): Promise<unknown> {
    const api = this.getApi();
    const { candidateRoots, nonce } = await this.getRestBootstrap();
    const errors: string[] = [];

    for (const root of candidateRoots) {
      const endpoint = new URL(
        this.buildRestEndpoint(root, `wp/v2/settings`)
      );

      const response = await api.get(endpoint.toString(), {
        headers: {
          'X-WP-Nonce': nonce,
        },
        failOnStatusCode: false,
      });

      if (!response.ok()) {
        errors.push(`get ${root} -> ${response.status()}`);
        continue;
      }

      const data = (await response.json()) as Record<string, unknown>;
      return data[optionName];
    }

    throw new Error(
      `Failed to get settings. Tried roots: ${candidateRoots.join(', ')}. Errors: ${errors.join('; ')}`
    );
  }

  async ensurePage(payload: PagePayload): Promise<void> {
    const api = this.getApi();
    const { candidateRoots, nonce } = await this.getRestBootstrap();
    const errors: string[] = [];

    for (const root of candidateRoots) {
      const listEndpoint = new URL(this.buildRestEndpoint(root, 'wp/v2/pages'));
      listEndpoint.searchParams.set('slug', payload.slug);
      listEndpoint.searchParams.set('_fields', 'id');

      const listResponse = await api.get(listEndpoint.toString(), {
        headers: {
          'X-WP-Nonce': nonce,
        },
        failOnStatusCode: false,
      });

      if (!listResponse.ok()) {
        errors.push(`list ${root} -> ${listResponse.status()}`);
        continue;
      }

      const existingPages = (await listResponse.json()) as Array<{ id: number }>;

      const saveEndpoint = existingPages.length
        ? this.buildRestEndpoint(root, `wp/v2/pages/${existingPages[0].id}`)
        : this.buildRestEndpoint(root, 'wp/v2/pages');

      const saveResponse = await api.post(saveEndpoint, {
        headers: {
          'X-WP-Nonce': nonce,
          'Content-Type': 'application/json',
        },
        data: {
          title: payload.title,
          slug: payload.slug,
          status: payload.status || 'publish',
          content: payload.content,
        },
        failOnStatusCode: false,
      });

      if (saveResponse.ok()) {
        return;
      }

      errors.push(`save ${root} -> ${saveResponse.status()}`);
    }

    throw new Error(
      `Failed to ensure page '${payload.slug}' via REST API. Tried roots: ${candidateRoots.join(', ')}. Errors: ${errors.join('; ')}`
    );
  }

  async ensurePrettyPermalinks(structure: string = '/%postname%/'): Promise<void> {
    try {
      await this.updateOption('permalink_structure', structure);
    } catch {
      // Some WordPress setups require the legacy admin form to flush rewrite rules.
    }

    const api = this.getApi();
    const settingsPage = await api.get('/wp-admin/options-permalink.php', { failOnStatusCode: false });
    const html = await settingsPage.text();
    const nonceMatch = html.match(/name="_wpnonce"\s+value="([^"]+)"/);

    if (!nonceMatch) {
      throw new Error('Unable to find permalink settings nonce in options-permalink.php.');
    }

    const saveResponse = await api.post('/wp-admin/options-permalink.php', {
      form: {
        _wpnonce: nonceMatch[1],
        _wp_http_referer: '/wp-admin/options-permalink.php',
        permalink_structure: structure,
        category_base: '',
        tag_base: '',
        submit: 'Save Changes',
      },
      failOnStatusCode: false,
    });

    const saveHtml = await saveResponse.text();
    if (saveResponse.status() >= 400 || saveHtml.includes('id="loginform"')) {
      throw new Error(`Failed to save permalink settings via admin form: ${saveResponse.status()}`);
    }
  }
}
