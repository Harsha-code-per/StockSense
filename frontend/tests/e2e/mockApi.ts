import type { Page } from '@playwright/test';
const product = {
  id: 12,
  sku: 'STL001',
  name: 'Steel Rod',
  category: { id: 1, name: 'Raw Material' },
  uom: 'kg',
  min_qty: '20.000',
  max_qty: '200.000',
  on_hand: '77.000',
  stock_status: 'in_stock',
  suggested_order: '0.000',
  is_active: true,
  created_at: '2026-09-26T09:00:00Z',
};
const warehouse = {
  id: 1,
  code: 'WH',
  name: 'Main Warehouse',
  address: 'Plot 4',
  is_active: true,
  location_count: 1,
};
export async function mockApi(page: Page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body: unknown = [];
    if (path === '/api/auth/me')
      body = {
        id: 1,
        name: 'Asha',
        role: 'manager',
        email: 'asha@example.test',
        created_at: product.created_at,
      };
    if (path === '/api/categories') body = [product.category];
    if (path === '/api/products')
      body =
        route.request().method() === 'POST'
          ? product
          : { items: [product], total: 1, page: 1, page_size: 20 };
    if (path === '/api/products/12')
      body = {
        ...product,
        stock_by_location: [
          {
            location_id: 1,
            location_name: 'WH/Stock',
            warehouse_id: 1,
            quantity: '77.000',
          },
        ],
        recent_moves: [],
      };
    if (path === '/api/warehouses')
      body = route.request().method() === 'POST' ? warehouse : [warehouse];
    if (path === '/api/locations')
      body = [
        {
          id: 1,
          warehouse_id: 1,
          warehouse_code: 'WH',
          name: 'Stock',
          full_name: 'WH/Stock',
          is_active: true,
        },
      ];
    await route.fulfill({ json: body });
  });
}
