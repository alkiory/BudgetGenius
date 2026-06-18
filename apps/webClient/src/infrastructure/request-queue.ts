type FailedRequest = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

class RequestQueue {
  private queue: FailedRequest[] = [];
  private isRefreshing = false;

  add(request: FailedRequest) {
    this.queue.push(request);
  }

  process(error: unknown, token?: string) {
    this.queue.forEach(({ resolve, reject }) => {
      error ? reject(error) : resolve(token!);
    });
    this.clear();
  }

  clear() {
    this.queue = [];
  }

  get refreshing() {
    return this.isRefreshing;
  }

  set refreshing(value: boolean) {
    this.isRefreshing = value;
  }
}

export const requestQueue = new RequestQueue();
