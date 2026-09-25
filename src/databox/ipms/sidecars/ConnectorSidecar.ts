import { runLdapSync } from './LdapConnector';
import { runOdbcSync } from './OdbcConnector';
import type { LdapConfig } from './LdapConnector';
import type { OdbcConfig } from './OdbcConnector';
import { applyMappingToJsonLd, parseMappingFromTurtle } from './RdfMapper';
import type { MappingDefinition } from './RdfMapper';

export interface ConnectorJobConfig {
  type: 'ldap' | 'odbc';
  ldap?: LdapConfig;
  odbc?: OdbcConfig;
  /** Optional R2RML/RML mapping definition (Turtle string). If absent, raw rows are output. */
  mappingTurtle?: string;
}

/**
 * Entry point for the CLI sidecar process.
 * Reads a JSON config from stdin and writes JSON-LD to stdout.
 */
async function main(): Promise<void> {
  const input = await readStdin();
  let config: ConnectorJobConfig;
  try {
    config = JSON.parse(input) as ConnectorJobConfig;
  } catch (err: unknown) {
    console.error('Failed to parse stdin as JSON:', err);
    process.exit(1);
  }

  try {
    let rows: Record<string, unknown>[];
    if (config.type === 'ldap' && config.ldap) {
      rows = await runLdapSync(config.ldap);
    } else if (config.type === 'odbc' && config.odbc) {
      rows = await runOdbcSync(config.odbc);
    } else {
      throw new Error(`Invalid or missing configuration for type '${config.type}'`);
    }

    // If a mapping is provided, apply it to produce JSON-LD; otherwise output raw rows
    let output: unknown;
    if (config.mappingTurtle) {
      const mapping: MappingDefinition = parseMappingFromTurtle(config.mappingTurtle);
      output = applyMappingToJsonLd(mapping, rows);
    } else {
      output = rows;
    }

    // Output valid JSON-LD
    console.log(JSON.stringify(output, null, 2));
  } catch (err: unknown) {
    console.error('Connector sidecar failed:', err);
    process.exit(1);
  }
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject): void => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string): void => {
      data += chunk;
    });
    process.stdin.on('end', (): void => {
      resolve(data);
    });
    process.stdin.on('error', reject);
  });
}

// Only run automatically if invoked as a script (works in both CJS and ESM)
if (process.argv[1]?.endsWith('ConnectorSidecar')) {
  main().catch((err: unknown): void => {
    console.error(err);
    process.exit(1);
  });
}
