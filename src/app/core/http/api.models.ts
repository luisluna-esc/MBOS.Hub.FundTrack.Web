// Formatos comunes de respuesta del backend (FundTrack.core/Entities/ResponseApi).

/** MessageType del backend: sin JsonStringEnumConverter llega como número (0, 1, 2). */
export type ApiMessageType = 0 | 1 | 2 | 'Success' | 'Error' | 'Warning';

export interface ApiMessage {
  type: ApiMessageType;
  description: string;
}

/** ResponseGetObject */
export interface ApiResponse<T> {
  data: T;
  messages: ApiMessage[];
}

/** ResponsePost: lo que devuelven POST, PUT y DELETE. */
export interface WriteResponse {
  id: number;
  messages: ApiMessage[];
}

/** PagedResult<T> */
export interface PagedResult<T> {
  items: T[];
  totalRecords: number;
  pageNumber: number;
  pageSize: number;
}

/** Valores de filtro tal como los manda la query string; los vacíos no se envían. */
export type QueryParams = Record<string, string | number | boolean | null | undefined>;
