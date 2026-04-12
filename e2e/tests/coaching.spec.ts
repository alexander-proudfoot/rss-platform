import { test, expect } from '@playwright/test'

test.describe('Coaching screen', () => {
  test.skip('shows mode selector when no session active', async ({ page }) => {
    await page.goto('/coaching')
    await expect(page.getByText('Pre-Call Coaching')).toBeVisible()
    await expect(page.getByText('Post-Call Debrief')).toBeVisible()
    await expect(page.getByText('Development Review')).toBeVisible()
  })
})
