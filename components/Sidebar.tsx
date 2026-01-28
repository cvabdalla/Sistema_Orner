
import React, { useState, useEffect } from 'react';
import { MENU_ITEMS } from '../constants';
import type { Page, MenuItem, User } from '../types';
import { ChevronDownIcon, XCircleIcon } from '../assets/icons';
import Logo from './Logo';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  currentUser: User;
  userPermissions: string[];
  onLogout: () => void;
  companyLogo?: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentPage, 
  setCurrentPage, 
  isSidebarOpen, 
  setSidebarOpen, 
  currentUser, 
  userPermissions,
  onLogout,
  companyLogo
}) => {
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);

  // Filtra itens de menu permitidos
  const filteredMenuItems = React.useMemo(() => {
    if (userPermissions.includes('ALL')) return MENU_ITEMS;

    return MENU_ITEMS.map(item => {
      if (item.children) {
        const allowedChildren = item.children.filter(child => 
            userPermissions.includes(child.id as string)
        );
        
        if (allowedChildren.length > 0) {
          return { ...item, children: allowedChildren };
        }
        
        if (userPermissions.includes(item.id as string)) {
            return { ...item, children: [] };
        }
        
        return null;
      }
      return userPermissions.includes(item.id as string) || item.id === 'DASHBOARD' ? item : null;
    }).filter(item => item !== null) as MenuItem[];
  }, [userPermissions]);

  useEffect(() => {
    const parent = filteredMenuItems.find(item => item.children?.some(child => child.id === currentPage));
    setOpenSubMenu(parent ? parent.id : null);
  }, [currentPage, filteredMenuItems]);

  const handleNavigation = (page: Page) => {
    setCurrentPage(page);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const toggleSubMenu = (id: string) => {
    setOpenSubMenu(openSubMenu === id ? null : id);
  };

  const isSubMenuActive = (item: MenuItem) => {
      return item.children?.some(child => child.id === currentPage) ?? false;
  }

  return (
    <>
      {isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden print:hidden"
            onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      <aside className={`fixed md:relative inset-y-0 left-0 bg-gray-900 text-gray-300 w-60 space-y-4 py-6 px-2 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out z-30 flex flex-col flex-shrink-0 border-r border-gray-800 text-sm print:hidden`}>
        <div className="px-6 mb-6 mt-2 flex justify-center md:justify-start min-h-[40px]">
          <a href="#" onClick={(e) => { e.preventDefault(); setCurrentPage('DASHBOARD'); }} className="flex items-center">
            <Logo variant="light" customLogo={companyLogo} />
          </a>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
          {filteredMenuItems.map((item) => (
            item.children && item.children.length > 0 ? (
              <div key={item.id}>
                <button
                  onClick={() => toggleSubMenu(item.id)}
                  className={`w-full flex items-center justify-between space-x-3 py-2 px-3 rounded-md transition duration-200 hover:bg-gray-800 hover:text-white ${
                    isSubMenuActive(item) ? 'text-white bg-gray-800' : 'text-gray-400'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <item.icon className="w-5 h-5 opacity-80" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <ChevronDownIcon className={`w-3 h-3 transition-transform duration-200 ${openSubMenu === item.id ? 'rotate-180' : ''}`} />
                </button>
                {openSubMenu === item.id && (
                  <div className="pl-9 mt-1 space-y-0.5">
                    {item.children.map(child => (
                      <a
                        key={child.id}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          handleNavigation(child.id as Page);
                        }}
                        className={`block py-1.5 px-3 rounded-md transition duration-200 hover:text-white text-xs font-medium ${
                          currentPage === child.id ? 'text-indigo-400' : 'text-gray-500'
                        }`}
                      >
                        {child.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <a
                key={item.id}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigation(item.id as Page);
                }}
                className={`flex items-center space-x-3 py-2 px-3 rounded-md transition duration-200 hover:bg-gray-800 hover:text-white ${
                  currentPage === item.id ? 'bg-gray-800 text-white' : 'text-gray-400'
                }`}
              >
                <item.icon className="w-5 h-5 opacity-80" />
                <span className="font-medium">{item.label}</span>
              </a>
            )
          ))}
        </nav>
        
        <div className="px-3 py-3 mt-auto border-t border-gray-800 space-y-3">
             <div className="flex items-center space-x-3">
                 <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {currentUser.avatar ? 
                        <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" /> :
                        <span className="text-white font-bold text-xs">{currentUser.name.substring(0, 2).toUpperCase()}</span>
                    }
                 </div>
                 <div className="overflow-hidden flex-1">
                     <p className="font-semibold text-white text-xs truncate">{currentUser.name}</p>
                     <p className="text-[10px] text-gray-500 truncate">{currentUser.email}</p>
                 </div>
             </div>

             <button 
                onClick={onLogout}
                className="w-full flex items-center gap-2 py-2 px-3 text-[11px] font-black text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
             >
                <XCircleIcon className="w-4 h-4" />
                Sair do Sistema
             </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
