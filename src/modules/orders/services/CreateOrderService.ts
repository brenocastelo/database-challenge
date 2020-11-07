import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';
import Product from '@modules/products/infra/typeorm/entities/Product';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

interface PurchasedProducts {
  product_id: string;
  price: number;
  quantity: number;
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    /**
     * recuperar cliente
     * recuperar produtos pelo id
     * criar pedidos com esses dados
     */

    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Product not found');
    }

    const existentsProductsInStock = await this.productsRepository.findAllById(
      products,
    );

    if (!existentsProductsInStock.length) {
      throw new AppError('The product selects are not founded');
    }

    // o indice deve ficar zero porque no filtro mais interno sempre vai haver só um elemento
    const productsWihoutEnoughStock = products.filter(product => {
      const stockedProducts = existentsProductsInStock.filter(
        storagedProduct => {
          return storagedProduct.id === product.id;
        },
      );

      return stockedProducts[0].quantity < product.quantity;
    });

    if (productsWihoutEnoughStock.length) {
      throw new AppError('Product selected has no enough qunatity');
    }

    const mappedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: this.getProductPrice(product.id, existentsProductsInStock),
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: mappedProducts,
    });

    const updatedQuantityProducts = this.updateProductQuantityInStock(
      existentsProductsInStock,
      mappedProducts,
    );

    await this.productsRepository.updateQuantity(updatedQuantityProducts);

    return order;
  }

  private updateProductQuantityInStock(
    existentsProductsInStock: Product[],
    products: PurchasedProducts[],
  ) {
    const updatedProductQuntityInStock = products.map(product => {
      const stockedProducts = existentsProductsInStock.filter(
        stockedProduct => product.product_id === stockedProduct.id,
      );

      const updatedQuantity = stockedProducts[0].quantity - product.quantity;

      return {
        id: product.product_id,
        quantity: updatedQuantity,
      };
    });

    return updatedProductQuntityInStock;
  }

  private getProductPrice(
    productsId: string,
    selectedProducts: Product[],
  ): number {
    const price = selectedProducts.filter(
      product => product.id === productsId,
    )[0].price;

    return price;
  }
}

export default CreateOrderService;
