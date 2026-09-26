// Owner: Member 3. Editable lines table for OperationForm.
// - receipt/delivery/transfer: product + quantity (> 0, ≤ 3 decimals)
// - adjustment: product + counted_quantity (≥ 0) with system / counted / difference preview
// - delivery/transfer/adjustment show "Available: N uom" beside each line.
// The frontend NEVER computes stock; "available"/"system" come from the API.
// Difference preview is a UI convenience only (display, never submitted as stock math).

"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OperationType } from "@/lib/operations";

export interface LineProduct {
  id: number;
  sku: string;
  name: string;
  uom: string;
}

export interface OperationFormValues {
  source_location_id?: number;
  destination_location_id?: number;
  partner_name?: string;
  scheduled_date?: string;
  notes?: string;
  lines: Array<{
    product_id?: number;
    quantity?: string;
    counted_quantity?: string;
  }>;
}

interface LineEditorProps {
  type: OperationType;
  products: LineProduct[];
  /** "Available: N" at the source location, key `${product_id}` */
  availableByProduct?: Record<number, string>;
  /** Adjustment preview: system quantity snapshot per product, from the API */
  systemByProduct?: Record<number, string>;
}

export function LineEditor({
  type,
  products,
  availableByProduct = {},
  systemByProduct = {},
}: LineEditorProps) {
  const form = useFormContext<OperationFormValues>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const isAdjustment = type === "adjustment";
  const showAvailable = type !== "receipt";

  const productOf = (id?: number) => products.find((p) => p.id === id);

  return (
    <div className="space-y-2">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">Product</TableHead>
              {isAdjustment ? (
                <>
                  <TableHead className="w-28 text-right">System</TableHead>
                  <TableHead className="w-32 text-right">Counted</TableHead>
                  <TableHead className="w-28 text-right">Difference</TableHead>
                </>
              ) : (
                <TableHead className="w-32 text-right">Quantity</TableHead>
              )}
              {showAvailable && (
                <TableHead className="w-32 text-right">Available</TableHead>
              )}
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => {
              const productId = form.watch(`lines.${index}.product_id`);
              const product = productOf(productId);
              const uom = product?.uom ?? "";
              const available = productId
                ? availableByProduct[productId]
                : undefined;
              const systemQty = productId
                ? systemByProduct[productId]
                : undefined;
              const counted = form.watch(`lines.${index}.counted_quantity`);
              const difference =
                isAdjustment && systemQty != null && counted != null && counted !== ""
                  ? (Number(counted) - Number(systemQty)).toFixed(3)
                  : null;

              return (
                <TableRow key={field.id}>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`lines.${index}.product_id`}
                      render={({ field: f }) => (
                        <FormItem>
                          <Select
                            value={f.value != null ? String(f.value) : undefined}
                            onValueChange={(v) => f.onChange(Number(v))}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={String(p.id)}>
                                  {p.sku} — {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {/* server field_errors arrive as lines.{i}.product_id */}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TableCell>

                  {isAdjustment && (
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {systemQty ?? "—"} {systemQty != null && uom}
                    </TableCell>
                  )}

                  <TableCell>
                    <FormField
                      control={form.control}
                      name={
                        isAdjustment
                          ? `lines.${index}.counted_quantity`
                          : `lines.${index}.quantity`
                      }
                      render={({ field: f }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              {...f}
                              inputMode="decimal"
                              placeholder="0.000"
                              className="text-right tabular-nums"
                              value={f.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TableCell>

                  {isAdjustment && (
                    <TableCell
                      className={`text-right tabular-nums ${
                        difference != null && Number(difference) !== 0
                          ? Number(difference) < 0
                            ? "text-red-600"
                            : "text-green-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {difference != null
                        ? `${Number(difference) > 0 ? "+" : ""}${difference}`
                        : "—"}{" "}
                      {difference != null && uom}
                    </TableCell>
                  )}

                  {showAvailable && (
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {available != null ? `${available} ${uom}` : "—"}
                    </TableCell>
                  )}

                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          append({ product_id: undefined, quantity: "", counted_quantity: "" })
        }
      >
        <Plus className="mr-2 h-4 w-4" /> Add line
      </Button>

      {/* top-level lines error, e.g. "at least 1 line" */}
      <p className="text-sm font-medium text-destructive">
        {form.formState.errors.lines?.message as string | undefined}
      </p>
    </div>
  );
}
