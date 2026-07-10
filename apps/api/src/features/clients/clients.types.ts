import type { Database } from "@atlashq/db";
import type { PaginationMeta } from "@atlashq/validators";

export type ClientQueryHandle = Pick<Database, "select" | "insert" | "update">;

export type ClientRow = {
  id: string;
  organizationId: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  notes: string | null;
  status: string;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
  softDeletedAt: Date | null;
  version: number;
};

export type ClientCursor = {
  sortName: string;
  clientId: string;
};

export type ClientListQuery = {
  organizationId: string;
  status?: string;
  search?: string;
  cursor?: ClientCursor;
  limit: number;
};

export type ClientListPage = {
  items: ClientRow[];
  pageInfo: PaginationMeta;
};

export type ClientCreateValues = {
  organizationId: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  notes: string | null;
  status: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
};

export type ClientUpdateValues = {
  name?: string;
  contactPerson?: string | null;
  email?: string | null;
  notes?: string | null;
  status?: string;
  updatedAt: Date;
  updatedBy: string;
};

export type ClientArchiveValues = {
  updatedAt: Date;
  updatedBy: string;
  status: "archived";
  version: number;
};

export interface ClientsRepository {
  list(handle: ClientQueryHandle, query: ClientListQuery): Promise<ClientListPage>;
  findById(
    handle: ClientQueryHandle,
    organizationId: string,
    clientId: string,
  ): Promise<ClientRow | null>;
  create(handle: ClientQueryHandle, values: ClientCreateValues): Promise<ClientRow>;
  update(
    handle: ClientQueryHandle,
    organizationId: string,
    clientId: string,
    expectedVersion: number,
    values: ClientUpdateValues,
  ): Promise<ClientRow | null>;
  archive(
    handle: ClientQueryHandle,
    organizationId: string,
    clientId: string,
    values: ClientArchiveValues,
  ): Promise<ClientRow | null>;
}
