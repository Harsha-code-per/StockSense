import { PageHeader } from '@/components/layout/PageHeader';
import { ProductForm } from '../ProductForm';
export default function NewProductPage() {
  return (
    <>
      <PageHeader
        title="New product"
        description="Add a product to your inventory catalog."
      />
      <ProductForm />
    </>
  );
}
