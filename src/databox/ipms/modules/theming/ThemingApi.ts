import type { IpmsModuleRouter } from '../../IpmsModuleRouter';
import type { HttpHandlerInput } from '../../../../server/HttpHandler';
import { readJsonBody, writeJson } from '../../IpmsHttpUtils';
import { themeToCss, themeToForgeTokens, validateThemePackage } from './Tokens';

export function registerThemingRoutes(router: IpmsModuleRouter<(input: HttpHandlerInput) => Promise<void>>): void {
  router.register('POST', '/theming/validate', async({ request, response }: HttpHandlerInput): Promise<void> => {
    try {
      const input = await readJsonBody<unknown>(request);
      writeJson(response, 200, validateThemePackage(input));
    } catch (error: unknown) {
      writeJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid theme package.' });
    }
  });

  router.register('POST', '/theming/css', async({ request, response }: HttpHandlerInput): Promise<void> => {
    try {
      const input = await readJsonBody<unknown>(request);
      const css = themeToCss(input);
      response.setHeader('content-type', 'text/css; charset=utf-8');
      response.writeHead(200);
      response.end(css);
    } catch (error: unknown) {
      writeJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid theme CSS request.' });
    }
  });

  router.register('POST', '/theming/smithy-tokens', async({ request, response }: HttpHandlerInput): Promise<void> => {
    try {
      const input = await readJsonBody<unknown>(request);
      writeJson(response, 200, themeToForgeTokens(input));
    } catch (error: unknown) {
      writeJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid smithy tokens request.' });
    }
  });
}
