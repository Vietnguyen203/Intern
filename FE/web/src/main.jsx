import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import CustomerOrderApp from './CustomerOrderApp.jsx'
import KitchenKioskPage from './features/dashboard/kitchen/KitchenKioskPage.jsx'

const path = window.location.pathname;

// /kitchen-kiosk: màn hình Bếp độc lập, mở ở tab/cửa sổ riêng qua window.open() từ nút
// "Chế độ Kiosk" trong tab Bếp — để có thể kéo sang màn hình/TV riêng gắn trong bếp.
const renderApp = () => {
  if (path.startsWith('/customer')) return <CustomerOrderApp />;
  if (path.startsWith('/kitchen-kiosk')) return <KitchenKioskPage />;
  return <App />;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {renderApp()}
  </StrictMode>,
)
