export interface ApiResponse<T> {
  status: number;
  message: string;
  timestamp: string;
  data: T;
  errors?: string[] | null;
}

export interface PageData<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface PageParams {
  page?: number;
  size?: number;
  sort?: string;
}
