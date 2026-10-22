/** Mismo formato que devuelve GET /api/menus/my-menu. */
export interface MenuTreeItem {
  menuId: number;
  name: string;
  /** Clave i18n opcional (ej. "nav.home"); si es null, se usa `name` literal. */
  translationKey: string | null;
  route: string | null;
  icon: string | null;
  displayOrder: number;
  /** Roles del usuario que tienen este item marcado: sirve para filtrar por el rol activo. */
  roles: string[];
  children: MenuTreeItem[];
}
