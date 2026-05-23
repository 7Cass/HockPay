import { describe, expect, it } from "vitest";
import { InvalidProductError } from "../errors/invalid-product.error";
import { Environment } from "../value-objects/environment.vo";
import { Product } from "./product.entity";

describe("Product", () => {
  it("creates a BRL catalog product scoped to an environment", () => {
    const product = Product.create({
      storeId: "store-1",
      externalId: "media-kit",
      name: "Media kit",
      description: "Premium package",
      price: 2500,
      imageUrl: "http://localhost/media-kit.png",
      metadata: { category: "demo" },
      environment: Environment.TEST,
    }).toObject();

    expect(product.currency).toBe("BRL");
    expect(product.environment).toBe(Environment.TEST);
    expect(product.isActive).toBe(true);
    expect(product.metadata).toEqual({ category: "demo" });
  });

  it("rejects free products", () => {
    expect(() =>
      Product.create({
        storeId: "store-1",
        name: "Free item",
        price: 0,
      }),
    ).toThrow(InvalidProductError);
  });

  it("archives products through isActive=false", () => {
    const product = Product.create({
      storeId: "store-1",
      name: "Media kit",
      price: 2500,
    });

    product.update({ isActive: false });

    expect(product.isActive).toBe(false);
  });
});
