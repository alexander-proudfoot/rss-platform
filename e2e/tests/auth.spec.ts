import { test, expect } from '@playwright/test'

test('unauthenticated user sees sign-in page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Sign in with Microsoft')).toBeVisible()
})

test('sign-in link points to AAD auth', async ({ page }) => {
  await page.goto('/')
  const link = page.getByRole('link', { name: 'Sign in with Microsoft' })
  await expect(link).toHaveAttribute('href', '/.auth/login/aad')
})
