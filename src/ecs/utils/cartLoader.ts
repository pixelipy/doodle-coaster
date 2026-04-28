// Cart definition shape:

/*
{
    "activeCartId": "cart-classic",
    "carts": [
        {
            "id": "cart-classic",
            "description": "The classic cart. A good all-rounder.",
            "parts": [
                {
                    "id": "cart_classic_body",
                    "colors": ["#5645FF"]
                },
                {
                    "id": "cart_classic_wheels",
                    "colors": ["#595959", "#F27930"]
                },
                {
                    "id": "cart_classic_grays",
                    "colors": ["#ACACAC"]
                }
            ]
        }
    ]
}



*/
type CartPartDefinition = {
    id: string
    colors: string[],
    currentActiveColor: number
}

type CartDefinition = {
    id: string
    description: string,
    scale: number,
    parts: CartPartDefinition[],
}

export async function loadCart(path: string, id: string): Promise<CartDefinition> {
    const response = await fetch(path);
    
    if (!response.ok) {
        throw new Error(`Failed to load cart definition from ${path}`);
    }

    const data = await response.json();
    const cart = data.carts.find((c: CartDefinition) => c.id === id);
    if (!cart) {
        throw new Error(`Cart with id ${id} not found in ${path}`);
    }

    return cart as CartDefinition;
}