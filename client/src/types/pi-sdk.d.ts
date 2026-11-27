export {};

declare global {
  interface Window {
    Pi?: {
      init(options: { version: string; sandbox: boolean }): void;
      authenticate(
        scopes: string[],
        onIncompletePaymentFound?: (payment: unknown) => void,
      ): Promise<{
        accessToken: string;
        user: { uid: string; username: string };
      }>;
    };
  }
}
