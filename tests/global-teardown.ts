import { execSync } from 'child_process';

async function globalTeardown(): Promise<void> {
  const isDockerMode = ['true', '1', 'yes'].includes((process.env.USE_DOCKER || '').trim().toLowerCase());
  if (!isDockerMode) {
    return;
  }

  console.log('Stopping Docker containers...');
  try {
    execSync('docker compose down --remove-orphans', { stdio: 'inherit' });

    const remainingIds = execSync('docker compose ps -aq', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .split(/\r?\n/)
      .map(id => id.trim())
      .filter(Boolean);

    if (remainingIds.length > 0) {
      console.log(`Force-removing remaining containers: ${remainingIds.join(', ')}`);
      execSync(`docker rm -f ${remainingIds.join(' ')}`, { stdio: 'inherit' });
    }

    console.log('Docker containers stopped.');
  } catch (error) {
    console.warn(
      'docker compose down failed:',
      error instanceof Error ? error.message : String(error)
    );
  }
}

export default globalTeardown;
