import { expect, test, describe } from "bun:test";
import { appInfoSchema, dynamicComposeSchema, dynamicComposeSchemaYaml } from '@runtipi/common/schemas'
import { fromError } from 'zod-validation-error';
import fs from 'node:fs'
import path from 'node:path'
import { type } from "arktype";

const getApps = async () => {
  const appsDir = await fs.promises.readdir(path.join(process.cwd(), 'apps'))

  const appDirs = appsDir.filter((app) => {
    const stat = fs.statSync(path.join(process.cwd(), 'apps', app))
    return stat.isDirectory()
  })

  return appDirs
};

const getFile = async (app: string, file: string) => {
  const filePath = path.join(process.cwd(), 'apps', app, file)
  try {
    const file = await fs.promises.readFile(filePath, 'utf-8')
    return file
  } catch (err) {
    return null
  }
}

const getComposeFile = async (app: string) => {
  const yaml = await getFile(app, 'docker-compose.yml')
  if (yaml !== null) {
    return { format: 'yml' as const, content: yaml }
  }

  const json = await getFile(app, 'docker-compose.json')
  if (json !== null) {
    return { format: 'json' as const, content: json }
  }

  return null
}

describe("each app should have the required files", async () => {
  const apps = await getApps()

  for (const app of apps) {
    test(`app ${app} should have config.json`, async () => {
      const fileContent = await getFile(app, 'config.json')
      expect(fileContent).not.toBeNull()
    })

    test(`app ${app} should have docker-compose.yml or docker-compose.json`, async () => {
      const compose = await getComposeFile(app)
      expect(compose).not.toBeNull()
    })

    test(`app ${app} should have metadata/logo.jpg`, async () => {
      const fileContent = await getFile(app, 'metadata/logo.jpg')
      expect(fileContent).not.toBeNull()
    })

    test(`app ${app} should have metadata/description.md`, async () => {
      const fileContent = await getFile(app, 'metadata/description.md')
      expect(fileContent).not.toBeNull()
    })
  }
})

describe("each app should have a valid config.json", async () => {
  const apps = await getApps()

  for (const app of apps) {
    test(`app ${app} should have a valid config.json`, async () => {
      const fileContent = await getFile(app, 'config.json')
      const parsed = appInfoSchema.omit('urn')(JSON.parse(fileContent || '{}'))

      if (parsed instanceof type.errors) {
        const validationError = fromError(parsed);
        console.error(`Error parsing config.json for app ${app}:`, validationError.toString());
      }

      expect(parsed instanceof type.errors).toBe(false)

      if (!(parsed instanceof type.errors)) {
        expect(parsed.id).toBe(app)
      }
    })
  }
})

describe("each app should have a valid compose file", async () => {
  const apps = await getApps()

  for (const app of apps) {
    test(`app ${app} should have a valid compose file`, async () => {
      const compose = await getComposeFile(app)
      expect(compose).not.toBeNull()

      if (!compose) {
        return
      }

      if (compose.format === 'json') {
        const parsed = dynamicComposeSchema(JSON.parse(compose.content || '{}'))

        if (parsed instanceof type.errors) {
          const validationError = fromError(parsed);
          console.error(`Error parsing docker-compose.json for app ${app}:`, validationError.toString());
        }

        expect(parsed instanceof type.errors).toBe(false)
        return
      }

      const doc = Bun.YAML.parse(compose.content) as Record<string, unknown>
      expect(doc).toBeTruthy()
      expect(typeof doc).toBe('object')
      expect(doc.services).toBeTruthy()

      const rootRuntipi = doc['x-runtipi'] as Record<string, unknown> | undefined
      if (rootRuntipi) {
        expect(rootRuntipi.schema_version).toBe(2)
      }

      // dynamicComposeSchemaYaml requires overrides[] when x-runtipi is present;
      // schema_version is accepted via the catch-all. Validate without that quirk.
      const { ['x-runtipi']: _ignored, ...withoutRootRuntipi } = doc
      const parsed = dynamicComposeSchemaYaml(withoutRootRuntipi)

      if (parsed instanceof type.errors) {
        const validationError = fromError(parsed);
        console.error(`Error parsing docker-compose.yml for app ${app}:`, validationError.toString());
      }

      expect(parsed instanceof type.errors).toBe(false)

      const services = doc.services as Record<string, { 'x-runtipi'?: { is_main?: boolean } }>
      const hasMain = Object.values(services).some((service) => service?.['x-runtipi']?.is_main === true)
      expect(hasMain).toBe(true)
    })
  }
});
