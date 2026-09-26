'use client';
import { useState } from 'react';
import { Plus, Pencil, MapPin } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { selectClass } from '@/components/ui/Field';
import { DataState } from '@/components/ui/DataState';
import { useApi } from '@/components/ui/useApi';
import type { Warehouse, Location, User } from '@/lib/types';
import { WarehouseForm } from './WarehouseForm';
import { LocationForm } from './LocationForm';

type Editor =
  | { type: 'warehouse'; warehouse?: Warehouse }
  | { type: 'location'; warehouse: Warehouse; location?: Location };
export default function WarehousesPage() {
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('true');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Warehouse>();
  const [editor, setEditor] = useState<Editor>();
  const [pending, setPending] = useState(false);
  const warehouses = useApi<Warehouse[]>(
    `/api/warehouses${active ? `?is_active=${active}` : ''}`,
  );
  const user = useApi<User>('/api/auth/me');
  const manager = user.data?.role === 'manager';
  const rows =
    warehouses.data?.filter((warehouse) =>
      `${warehouse.name} ${warehouse.code} ${warehouse.address ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) ?? [];
  const visible = rows.slice((page - 1) * 10, page * 10);
  const [locationVersion, setLocationVersion] = useState(0);
  function saved() {
    if (editor?.type === 'warehouse') setSelected(undefined);
    setEditor(undefined);
    warehouses.reload();
    setLocationVersion((value) => value + 1);
  }
  return (
    <>
      <PageHeader
        title="Warehouses"
        description="Organize where inventory lives, from warehouses to individual locations."
      >
        {manager && (
          <Button onClick={() => setEditor({ type: 'warehouse' })}>
            <Plus aria-hidden="true" />
            New warehouse
          </Button>
        )}
      </PageHeader>
      <section
        aria-label="Warehouses"
        className="min-w-0 overflow-hidden rounded-xl border bg-card"
      >
        <div className="flex flex-wrap gap-3 border-b p-4">
          <div className="min-w-48 flex-1">
            <Label htmlFor="warehouse-search" className="sr-only">
              Search warehouses
            </Label>
            <Input
              id="warehouse-search"
              placeholder="Search name, code, or address"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-full sm:w-44">
            <Label htmlFor="warehouse-status" className="sr-only">
              Warehouse status
            </Label>
            <select
              id="warehouse-status"
              value={active}
              className={selectClass}
              onChange={(event) => {
                setActive(event.target.value);
                setPage(1);
                setSelected(undefined);
              }}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
              <option value="">All warehouses</option>
            </select>
          </div>
        </div>
        {warehouses.loading || warehouses.error || !visible.length ? (
          <DataState
            loading={warehouses.loading}
            error={warehouses.error}
            retry={warehouses.reload}
            empty="No warehouses match your filters."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Warehouse</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Locations</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((warehouse) => (
                <TableRow
                  key={warehouse.id}
                  data-state={
                    selected?.id === warehouse.id ? 'selected' : undefined
                  }
                >
                  <TableCell className="py-4 pl-5">
                    <div className="font-medium">{warehouse.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {warehouse.code}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-60 whitespace-normal text-muted-foreground">
                    {warehouse.address || '—'}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {warehouse.location_count}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {warehouse.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        aria-label={`Locations for ${warehouse.name}`}
                        onClick={() => setSelected(warehouse)}
                      >
                        <MapPin aria-hidden="true" />
                        Locations
                      </Button>
                      {manager && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${warehouse.name}`}
                          onClick={() =>
                            setEditor({ type: 'warehouse', warehouse })
                          }
                        >
                          <Pencil aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground">
          <span>
            {rows.length} warehouses · Page {page}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page === 1 || warehouses.loading}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={page * 10 >= rows.length || warehouses.loading}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
      {selected && (
        <Locations
          key={`${selected.id}-${locationVersion}`}
          warehouse={
            warehouses.data?.find(
              (warehouse) => warehouse.id === selected.id,
            ) ?? selected
          }
          manager={manager}
          onEdit={(location) =>
            setEditor({ type: 'location', warehouse: selected, location })
          }
        />
      )}
      <Dialog
        open={!!editor}
        onOpenChange={(open) => {
          if (!open && !pending) setEditor(undefined);
        }}
      >
        <DialogContent
          showCloseButton={!pending}
          className="max-h-[90dvh] overflow-y-auto bg-card"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {editor?.type === 'warehouse'
                ? editor.warehouse
                  ? 'Edit warehouse'
                  : 'New warehouse'
                : editor?.location
                  ? 'Edit location'
                  : 'New location'}
            </DialogTitle>
            <DialogDescription>
              {editor?.type === 'warehouse'
                ? 'Warehouse codes identify locations and stock movements.'
                : `A storage location within ${editor?.warehouse.name ?? 'this warehouse'}.`}
            </DialogDescription>
          </DialogHeader>
          {editor?.type === 'warehouse' ? (
            <WarehouseForm
              warehouse={editor.warehouse}
              onSaved={saved}
              onPending={setPending}
            />
          ) : (
            editor && (
              <LocationForm
                warehouse_id={editor.warehouse.id}
                location={editor.location}
                onSaved={saved}
                onPending={setPending}
              />
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function Locations({
  warehouse,
  manager,
  onEdit,
}: {
  warehouse: Warehouse;
  manager: boolean;
  onEdit: (location?: Location) => void;
}) {
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('true');
  const [page, setPage] = useState(1);
  const locations = useApi<Location[]>(
    `/api/locations?warehouse_id=${warehouse.id}${active ? `&is_active=${active}` : ''}`,
  );
  const rows =
    locations.data?.filter((location) =>
      location.full_name.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  return (
    <section
      aria-label={`Locations in ${warehouse.name}`}
      className="mt-8 min-w-0 overflow-hidden rounded-xl border bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
        <div>
          <h2 className="text-lg font-semibold">{warehouse.name} locations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage storage locations within {warehouse.code}.
          </p>
        </div>
        {manager && warehouse.is_active && (
          <Button variant="outline" onClick={() => onEdit()}>
            <Plus aria-hidden="true" />
            New location
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-3 border-b p-4">
        <div className="min-w-48 flex-1">
          <Label htmlFor="location-search" className="sr-only">
            Search locations
          </Label>
          <Input
            id="location-search"
            placeholder="Search locations"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-full sm:w-44">
          <Label htmlFor="location-status" className="sr-only">
            Location status
          </Label>
          <select
            id="location-status"
            className={selectClass}
            value={active}
            onChange={(event) => {
              setActive(event.target.value);
              setPage(1);
            }}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
            <option value="">All locations</option>
          </select>
        </div>
      </div>
      {locations.loading || locations.error || !rows.length ? (
        <DataState
          loading={locations.loading}
          error={locations.error}
          retry={locations.reload}
          empty="No locations match your filters."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice((page - 1) * 10, page * 10).map((location) => (
              <TableRow key={location.id}>
                <TableCell className="py-4 pl-5 font-medium">
                  {location.full_name}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {location.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {manager && (
                    <Button
                      variant="ghost"
                      aria-label={`Edit ${location.full_name}`}
                      onClick={() => onEdit(location)}
                    >
                      <Pencil aria-hidden="true" />
                      Edit
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground">
        <span>
          {rows.length} locations · Page {page}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={page === 1 || locations.loading}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={page * 10 >= rows.length || locations.loading}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
