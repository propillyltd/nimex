import { useState, useEffect } from 'react';

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
}

export const useCart = () => {
  const [itemCount, setItemCount] = useState(0);

  const updateCartCount = () => {
    try {
      const cartJson = localStorage.getItem('nimex_cart');
      if (cartJson) {
        const cart: CartItem[] = JSON.parse(cartJson);
        const total = cart.reduce((sum, item) => sum + item.quantity, 0);
        setItemCount(total);
      } else {
        setItemCount(0);
      }
    } catch (error) {
      console.error('Error reading cart:', error);
      setItemCount(0);
    }
  };

  useEffect(() => {
    // Initial load
    updateCartCount();

    // Listen for storage changes from other tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'nimex_cart') {
        updateCartCount();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom cart update events
    const handleCartUpdate = () => {
      updateCartCount();
    };

    window.addEventListener('cartUpdated', handleCartUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('cartUpdated', handleCartUpdate);
    };
  }, []);

  return { itemCount, updateCartCount };
};

// Helper function to trigger cart updates
export const triggerCartUpdate = () => {
  window.dispatchEvent(new Event('cartUpdated'));
};
