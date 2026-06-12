import type { Page } from "@playwright/test";

export default class MockAPI {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goodResponseMock(endpoint: string, body?: object) {
    this.page.route(endpoint, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body)
      })
    })
  }
  async badResponseMock(endpoint: string, body?: object) {
    this.page.route(endpoint, (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify(body)
      })
    })
  }
  async notAuthResponseMock(endpoint: string, body?: object) {
    this.page.route(endpoint, (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify(body)
      })
    })
  }
}