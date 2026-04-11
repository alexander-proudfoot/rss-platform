import { test, expect } from '@playwright/test'

test.describe('Dashboard screen', () => {
  test.skip('shows development dashboard heading', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText('Development Dashboard')).toBeVisible()
  })
})
