import type { APIRequestContext } from "@playwright/test";

const HTTP_METHODS = {
  GET: "get",
  POST: "post",
  PUT: "put",
  DELETE: "delete",
} as const;

type HttpMethod = (typeof HTTP_METHODS)[keyof typeof HTTP_METHODS];

export default class AppAPI {
  private apiContext: APIRequestContext;

  constructor(apiContext: APIRequestContext) {
    this.apiContext = apiContext;
  }

  private async callRequest(
    endpoint: string,
    method: HttpMethod,
    body?: object,
  ) {
    try {
      const response = await this.apiContext[method](endpoint, {
        headers: {
          Accept: "application/json",
        },
        data: body,
      });

      return response;
    } catch (error) {
      const endpointError = `Request to ${endpoint} failed`;
      throw new Error(`Failed to ${method} ${endpointError}: ${error}`);
    }
  }

  async get(endpoint: string) {
    return this.callRequest(endpoint, HTTP_METHODS.GET);
  }

  async post(endpoint: string, body?: object) {
    return this.callRequest(endpoint, HTTP_METHODS.POST, body);
  }
}
