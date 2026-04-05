import { execSync } from 'child_process';

async function globalTeardown(): Promise<void> {
  const isDockerMode = ['true', '1', 'yes'].includes((process.env.USE_DOCKER || '').trim().toLowerCase());
  if (!isDockerMode) {
    return;
  }

  console.log('Stopping Docker containers...');
  try {
    execSync('docker compose down', { stdio: 'inherit' });
    console.log('Docker containers stopped.');
  } catch (error) {
    console.warn(
      'docker compose down failed:',
      error instanceof Error ? error.message : String(error)
    );
  }
}

export default globalTeardown;
