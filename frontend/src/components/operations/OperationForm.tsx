// Owner: Member 3. Create/edit form for all four operation types.
// Field shape per type (docs/API.md "OperationCreate"):
//   receipt:    destination_location_id + partner_name (vendor),   lines.quantity
//   delivery:   source_location_id + partner_name (customer),      lines.quantity
//   transfer:   source_location_id + destination_location_id (≠),  lines.quantity
//   adjustment: source_location_id,                                lines.counted_quantity
// Every form: zod schema + inline errors + server field_errors mapped to fields.
// No stock math here — availability/system quantities come from the API.

"use client";

import { useMemo, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
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
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MOCK_AVAILABLE,
  MOCK_LOCATIONS,
  MOCK_PRODUCTS,
  type OperationCreateInput,
  type OperationType,
} from "@/lib/operations";
import { LineEditor, type OperationFormValues } from "./LineEditor";

// --- zod schema (mirrors INVENTORY_RULES §Validation) ----------------------

const qty = z
  .string()
  .min(1, "Required")
  .refine((v) => /^\d{1,13}(\.\d{1,3})?$/.test(v), "Max 3 decimals")
  .refine((v) => Number(v) > 0, "Must be greater than 0");

const countedQty = z
  .string()
  .min(1, "Required")
  .refine((v) => /^\d{1,13}(\.\d{1,3})?$/.test(v), "Max 3 decimals");

function schemaFor(type: OperationType) {
  const line =
    type === "adjustment"
      ? z.object({
          product_id: z.number({ error: "Select a product" }),
          counted_quantity: countedQty,
          quantity: z.string().optional(),
        })
      : z.object({
          product_id: z.number({ error: "Select a product" }),
          quantity: qty,
          counted_quantity: z.string().optional(),
        });

  return z
    .object({
      source_location_id: z.number().optional(),
      destination_location_id: z.number().optional(),
      partner_name: z.string().max(120).optional(),
      scheduled_date: z.string().optional(),
      notes: z.string().optional(),
      lines: z.array(line).min(1, "Add at least one line"),
    })
    .superRefine((values, ctx) => {
      // no duplicate product per operation
      const seen = new Set<number>();
      values.lines.forEach((l, i) => {
        if (l.product_id == null) return;
        if (seen.has(l.product_id)) {
          ctx.addIssue({
            code: "custom",
            path: ["lines", i, "product_id"],
            message: "Duplicate product in this operation",
          });
        }
        seen.add(l.product_id);
      });
      // location shape per type
      if (type === "receipt" && values.destination_location_id == null) {
        ctx.addIssue({
          code: "custom",
          path: ["destination_location_id"],
          message: "Required",
        });
      }
      if (type !== "receipt" && values.source_location_id == null) {
        ctx.addIssue({
          code: "custom",
          path: ["source_location_id"],
          message: "Required",
        });
      }
      if (type === "transfer") {
        if (values.destination_location_id == null) {
          ctx.addIssue({
            code: "custom",
            path: ["destination_location_id"],
            message: "Required",
          });
        } else if (
          values.source_location_id != null &&
          values.source_location_id === values.destination_location_id
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["destination_location_id"],
            message: "Source and destination must differ",
          });
        }
      }
    });
}

// --- component --------------------------------------------------------------

const TITLES: Record<OperationType, string> = {
  receipt: "Receipt",
  delivery: "Delivery",
  transfer: "Transfer",
  adjustment: "Adjustment",
};

interface OperationFormProps {
  type: OperationType;
  /** Swap for createOperation/updateOperation from lib/operations.ts in Phase 2 */
  onSubmit?: (payload: OperationCreateInput) => Promise<unknown>;
  defaultValues?: Partial<OperationFormValues>;
}

export function OperationForm({ type, onSubmit, defaultValues }: OperationFormProps) {
  const [pending, setPending] = useState(false);
  const schema = useMemo(() => schemaFor(type), [type]);

  const form = useForm<OperationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      partner_name: "",
      scheduled_date: "",
      notes: "",
      lines: [{ product_id: undefined, quantity: "", counted_quantity: "" }],
      ...defaultValues,
    },
  });

  const sourceLocationId = form.watch("source_location_id");

  // Phase 1 mocks — replaced by GET /api/inventory/available per line.
  const availableByProduct = useMemo(() => {
    if (type === "receipt" || sourceLocationId == null) return {};
    const map: Record<number, string> = {};
    for (const p of MOCK_PRODUCTS) {
      const v = MOCK_AVAILABLE[`${p.id}:${sourceLocationId}`];
      if (v != null) map[p.id] = v;
    }
    return map;
  }, [type, sourceLocationId]);

  async function handleSubmit(values: OperationFormValues) {
    const payload: OperationCreateInput = {
      type,
      source_location_id: values.source_location_id,
      destination_location_id: values.destination_location_id,
      partner_name: values.partner_name || null,
      scheduled_date: values.scheduled_date || null,
      notes: values.notes || null,
      lines: values.lines.map((l) => ({
        product_id: l.product_id!,
        ...(type === "adjustment"
          ? { counted_quantity: l.counted_quantity }
          : { quantity: l.quantity }),
      })),
    };

    setPending(true);
    try {
      if (onSubmit) {
        await onSubmit(payload);
      } else {
        // Phase 1: mock submit
        await new Promise((r) => setTimeout(r, 300));
        // eslint-disable-next-line no-console
        console.log("[mock] create operation", payload);
      }
      toast.success(`${TITLES[type]} saved as draft.`);
      form.reset();
  } catch (err: unknown) {
      // Phase 2: map ApiError.field_errors onto fields via form.setError
      const e = err as { message?: string; field_errors?: { field: string; message: string }[] };
      e.field_errors?.forEach((fe) =>
        form.setError(fe.field as never, { message: fe.message }),
      );
      toast.error(e.message ?? "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  const needsSource = type !== "receipt";
  const needsDestination = type === "receipt" || type === "transfer";
  const needsPartner = type === "receipt" || type === "delivery";

  return (
    <Card>
      <CardHeader>
        <CardTitle>New {TITLES[type]}</CardTitle>
      </CardHeader>
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {needsSource && (
                <FormField
                  control={form.control}
                  name="source_location_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {type === "adjustment" ? "Counted location" : "Source location"}
                      </FormLabel>
                      <Select
                        value={field.value != null ? String(field.value) : undefined}
                        onValueChange={(v) => field.onChange(Number(v))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MOCK_LOCATIONS.map((l) => (
                            <SelectItem key={l.id} value={String(l.id)}>
                              {l.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {needsDestination && (
                <FormField
                  control={form.control}
                  name="destination_location_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destination location</FormLabel>
                      <Select
                        value={field.value != null ? String(field.value) : undefined}
                        onValueChange={(v) => field.onChange(Number(v))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MOCK_LOCATIONS.map((l) => (
                            <SelectItem key={l.id} value={String(l.id)}>
                              {l.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {needsPartner && (
                <FormField
                  control={form.control}
                  name="partner_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {type === "receipt" ? "Vendor" : "Customer"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={
                            type === "receipt" ? "Tata Steel Ltd" : "Customer name"
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="scheduled_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scheduled date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Optional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <LineEditor
              type={type}
              products={MOCK_PRODUCTS}
              availableByProduct={availableByProduct}
              systemByProduct={
                type === "adjustment" ? availableByProduct : undefined
              }
            />
          </CardContent>

          <CardFooter className="gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save draft"}
            </Button>
          </CardFooter>
        </form>
      </FormProvider>
    </Card>
  );
}
