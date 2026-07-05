import { test, expect } from '@playwright/test';
import { ADMIN_PASSWORD, ADMIN_USERNAME } from '../constants';

const EXAMPLE_RULE = '[example.org *.example.org]:[192.168.1.1][2001:db8::1][alias.example]';

test.describe('Rewrites', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login.html');
        await page.getByTestId('username').click();
        await page.getByTestId('username').fill(ADMIN_USERNAME);
        await page.getByTestId('password').click();
        await page.getByTestId('password').fill(ADMIN_PASSWORD);
        await page.keyboard.press('Tab');
        await page.getByTestId('sign_in').click();
        await page.waitForURL((url) => !url.href.endsWith('/login.html'));
        await page.goto('/#dns_rewrites');
    });

    test('should edit DNS rewrite text rules', async ({ page }) => {
        const textarea = page.getByTestId('rewrite_rules_textarea');
        const originalRules = await textarea.inputValue();

        await textarea.fill(EXAMPLE_RULE);
        await page.getByTestId('rewrite_rules_save').click();

        await expect(textarea).toHaveValue(EXAMPLE_RULE);

        await textarea.fill(originalRules);
        await page.getByTestId('rewrite_rules_save').click();
        await expect(textarea).toHaveValue(originalRules);
    });
});
