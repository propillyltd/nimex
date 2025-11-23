import { supabase } from '../lib/supabase';
import { Database } from '../types/database';

export type CartItem = Database['public']['Tables']['cart_items']['Row'] & {
    product?: Database['public']['Tables']['products']['Row'];
};

export type Cart = Database['public']['Tables']['carts']['Row'] & {
    items: CartItem[];
};

export const CartService = {
    async getCart(): Promise<Cart | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data: cart, error } = await supabase
            .from('carts' as any)
            .select('*, items:cart_items(*, product:products(*))')
            .eq('user_id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
            console.error('Error fetching cart:', error);
            return null;
        }

        return cart as Cart;
    },

    async addToCart(productId: string, quantity: number = 1): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // 1. Get or create cart
        let { data: cart } = await supabase
            .from('carts' as any)
            .select('id')
            .eq('user_id', user.id)
            .single();

        if (!cart) {
            const { data: newCart, error: createError } = await supabase
                .from('carts' as any)
                .insert({ user_id: user.id })
                .select('id')
                .single();

            if (createError) throw createError;
            cart = newCart;
        }

        if (!cart) throw new Error('Failed to create cart');

        // 2. Check if item exists
        const { data: existingItem } = await supabase
            .from('cart_items' as any)
            .select('id, quantity')
            .eq('cart_id', cart.id)
            .eq('product_id', productId)
            .single();

        if (existingItem) {
            // Update quantity
            const { error } = await supabase
                .from('cart_items' as any)
                .update({ quantity: existingItem.quantity + quantity })
                .eq('id', existingItem.id);

            if (error) throw error;
        } else {
            // Insert new item
            const { error } = await supabase
                .from('cart_items' as any)
                .insert({
                    cart_id: cart.id,
                    product_id: productId,
                    quantity
                });

            if (error) throw error;
        }
    },

    async updateQuantity(itemId: string, quantity: number): Promise<void> {
        if (quantity <= 0) {
            await this.removeFromCart(itemId);
            return;
        }

        const { error } = await supabase
            .from('cart_items' as any)
            .update({ quantity })
            .eq('id', itemId);

        if (error) throw error;
    },

    async removeFromCart(itemId: string): Promise<void> {
        const { error } = await supabase
            .from('cart_items' as any)
            .delete()
            .eq('id', itemId);

        if (error) throw error;
    },

    async clearCart(): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: cart } = await supabase
            .from('carts' as any)
            .select('id')
            .eq('user_id', user.id)
            .single();

        if (cart) {
            const { error } = await supabase
                .from('cart_items' as any)
                .delete()
                .eq('cart_id', cart.id);

            if (error) throw error;
        }
    },

    async getCartCount(): Promise<number> {
        const cart = await this.getCart();
        if (!cart || !cart.items) return 0;
        return cart.items.reduce((sum, item) => sum + item.quantity, 0);
    }
};
