import { test, expect } from '@playwright/test';

/**
 * Helper: switch language via the language switcher UI in the header.
 * Opens the dropdown and clicks the given language label.
 */
async function switchLanguage(page: import('@playwright/test').Page, label: string) {
  await page.getByLabel('Switch language').click();
  await page.getByText(label).click();
  // Give React time to re-render after Redux dispatches the locale change
  await page.waitForTimeout(400);
}

test.describe('i18n: Legal and Contact Pages', () => {

  // ---------------------------------------------------------------------------
  // Privacy Policy
  // ---------------------------------------------------------------------------
  test.describe('Privacy Policy (/privacy-policy)', () => {
    test('switches between English and Spanish via the language switcher', async ({ page }) => {
      await page.goto('/privacy-policy');

      // --- English ---
      await expect(page.getByRole('heading', { name: 'Privacy Policy', exact: true })).toBeVisible();
      await expect(page.getByText('Information We Collect').first()).toBeVisible();
      await expect(page.getByText('How We Use Your Information')).toBeVisible();
      await expect(page.getByText('At Budget Genius, we take your privacy seriously')).toBeVisible();
      await expect(page.getByText('Back to Home')).toBeVisible();

      // --- Switch to Spanish ---
      await switchLanguage(page, 'Español');

      await expect(page.getByRole('heading', { name: 'Política de Privacidad', exact: true })).toBeVisible();
      await expect(page.getByText('Información que Recopilamos').first()).toBeVisible();
      await expect(page.getByText('Cómo Usamos tu Información')).toBeVisible();
      await expect(page.getByText('Volver al inicio')).toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // Terms of Service
  // ---------------------------------------------------------------------------
  test.describe('Terms of Service (/terms-and-conditions)', () => {
    test('switches between English and Spanish via the language switcher', async ({ page }) => {
      await page.goto('/terms-and-conditions');

      // --- English ---
      await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();
      await expect(page.getByText('Acceptance of Terms')).toBeVisible();
      await expect(page.getByText('Account Registration')).toBeVisible();
      await expect(page.getByText('These Terms of Service').first()).toBeVisible();
      await expect(page.getByText('Back to Home')).toBeVisible();

      // --- Switch to Spanish ---
      await switchLanguage(page, 'Español');

      await expect(page.getByRole('heading', { name: 'Términos del Servicio' })).toBeVisible();
      await expect(page.getByText('Aceptación de los Términos')).toBeVisible();
      await expect(page.getByText('Volver al inicio')).toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // Contact Sales
  // ---------------------------------------------------------------------------
  test.describe('Contact Sales (/contact-sales)', () => {
    test('switches between English and Spanish via the language switcher', async ({ page }) => {
      await page.goto('/contact-sales');

      // --- English ---
      await expect(page.getByRole('heading', { name: 'Contact Sales' })).toBeVisible();
      await expect(page.getByText('Enterprise-grade security')).toBeVisible();
      await expect(page.getByText('Team collaboration')).toBeVisible();
      await expect(page.getByText('Full Name')).toBeVisible();
      await expect(page.getByText('Back to Home')).toBeVisible();

      // --- Switch to Spanish ---
      await switchLanguage(page, 'Español');

      await expect(page.getByRole('heading', { name: 'Contactar Ventas' })).toBeVisible();
      await expect(page.getByText('Seguridad de nivel empresarial')).toBeVisible();
      await expect(page.getByText('Colaboración en equipo')).toBeVisible();
      await expect(page.getByText('Nombre completo')).toBeVisible();
      await expect(page.getByText('Volver al inicio')).toBeVisible();
    });
  });
});
