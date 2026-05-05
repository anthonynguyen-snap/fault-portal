import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

interface KPIConfig {
  repliesPerDay: number;
  resolveRate: number;
  csat: number;
}

const DEFAULT_CONFIG: KPIConfig = {
  repliesPerDay: 60,
  resolveRate: 30,
  csat: 3.0,
};

const CONFIG_PATH = resolve(process.cwd(), 'lib', 'kpi-config.json');

async function readConfig(): Promise<KPIConfig> {
  try {
    const data = await readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function writeConfig(config: KPIConfig): Promise<void> {
  try {
    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('Failed to write config file:', err);
    // On Vercel, filesystem is read-only. That's okay - we'll just return the config.
    // On next deploy, it will fall back to defaults.
  }
}

function isValidConfig(config: any): config is KPIConfig {
  return (
    typeof config === 'object' &&
    typeof config.repliesPerDay === 'number' &&
    typeof config.resolveRate === 'number' &&
    typeof config.csat === 'number' &&
    config.repliesPerDay > 0 &&
    config.resolveRate > 0 &&
    config.csat > 0
  );
}

export async function GET() {
  try {
    const config = await readConfig();
    return Response.json(config);
  } catch (err) {
    console.error('GET /api/config error:', err);
    return Response.json(DEFAULT_CONFIG);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!isValidConfig(body)) {
      return Response.json(
        { error: 'Invalid config: all values must be positive numbers' },
        { status: 400 }
      );
    }

    await writeConfig(body);
    return Response.json(body);
  } catch (err: any) {
    console.error('POST /api/config error:', err);
    return Response.json(
      { error: err.message || 'Failed to update config' },
      { status: 500 }
    );
  }
}
