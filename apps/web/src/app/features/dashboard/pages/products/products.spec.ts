import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProductItem, ProductService } from '../../../../core/services/product.service';
import { Products } from './products';

describe('Products', () => {
    const product: ProductItem = {
        id: 'product-1',
        storeId: 'store-1',
        name: 'Produto',
        price: 2500,
        currency: 'BRL',
        environment: 'TEST',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    };

    function createComponent() {
        const service = {
            load: vi.fn(),
            create: vi.fn(),
            update: vi.fn(() => of({ product: { ...product, isActive: false } })),
            products: signal([]),
            total: signal(0),
            isLoading: signal(false),
            error: signal(null),
        };

        TestBed.configureTestingModule({
            providers: [{ provide: ProductService, useValue: service }],
        });

        return {
            component: TestBed.runInInjectionContext(() => new Products()),
            service,
        };
    }

    it('does not archive before the confirmation dialog is confirmed', () => {
        const { component, service } = createComponent();

        component.archive(product);

        expect(component.archiveDialogState()).toBe('open');
        expect(component.productToArchive()).toBe(product);
        expect(service.update).not.toHaveBeenCalled();
    });

    it('archives after confirmation and can reactivate inactive products', () => {
        const { component, service } = createComponent();

        component.archive(product);
        component.confirmArchive();
        component.reactivate({ ...product, isActive: false });

        expect(service.update).toHaveBeenNthCalledWith(1, 'product-1', { isActive: false });
        expect(service.update).toHaveBeenNthCalledWith(2, 'product-1', { isActive: true });
    });

    it('loads inactive products through the active filter', () => {
        const { component, service } = createComponent();

        component.setActiveFilter('inactive');

        expect(service.load).toHaveBeenCalledWith({ page: 1, limit: 50, isActive: false });
    });
});
