import { component$, useStyles$ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  z,
  zod$,
  Link,
} from "@builder.io/qwik-city";
import { getDB, camelize } from "~/db";
import {
  students,
  studentSubscriptions,
  studentPayments,
  cashRegisters,
  cashMovements,
} from "~/db/schema";
import { Button } from "~/components/ui";

export const useStudentDetailsData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const studentId = requestEvent.params.id;

  const { data: studentData, error: studentErr } = await db
    .from(students)
    .select("*")
    .eq("id", studentId)
    .maybeSingle();

  if (studentErr || !studentData) {
    throw requestEvent.redirect(302, "/admin/escuelita/");
  }
  const student = camelize<any>(studentData);

  const { data: subsData, error: subsErr } = await db
    .from(studentSubscriptions)
    .select("*")
    .eq("student_id", studentId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (subsErr) throw subsErr;
  const subscriptions = camelize<any[]>(subsData || []);

  return {
    student,
    subscriptions,
  };
});

export const useGenerateSubscriptionAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const { error } = await db.from(studentSubscriptions).insert({
      id: crypto.randomUUID(),
      student_id: data.studentId,
      month: Number(data.month),
      year: Number(data.year),
      price: Number(data.price),
      status: "PENDING",
    });

    if (error) throw error;
    return { success: true };
  },
  zod$({
    studentId: z.string(),
    month: z.string(),
    year: z.string(),
    price: z.string(),
  }),
);

export const usePaySubscriptionAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const subscriptionId = data.subscriptionId;

    const { data: subData, error: subErr } = await db
      .from(studentSubscriptions)
      .select("*")
      .eq("id", subscriptionId)
      .maybeSingle();

    if (subErr || !subData) return { success: false, message: "Cuota no encontrada" };
    const sub = camelize<any>(subData);

    const { data: stData, error: stErr } = await db
      .from(students)
      .select("*")
      .eq("id", sub.studentId)
      .maybeSingle();

    if (stErr) throw stErr;
    const st = camelize<any>(stData);

    const { error: updErr } = await db
      .from(studentSubscriptions)
      .update({ status: "PAID" })
      .eq("id", subscriptionId);

    if (updErr) throw updErr;

    const paymentId = crypto.randomUUID();
    const { error: payErr } = await db.from(studentPayments).insert({
      id: paymentId,
      subscription_id: subscriptionId,
      amount: sub.price,
      payment_method: data.paymentMethod,
    });

    if (payErr) throw payErr;

    // Impact open cash register
    if (data.paymentMethod && data.paymentMethod !== "NONE") {
      const { data: openRegisterData, error: regErr } = await db
        .from(cashRegisters)
        .select("*")
        .eq("status", "OPEN")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (regErr) throw regErr;
      const openRegister = camelize<any>(openRegisterData);

      if (openRegister) {
        const { error: movErr } = await db.from(cashMovements).insert({
          id: crypto.randomUUID(),
          register_id: openRegister.id,
          type: "INCOME",
          category: "SCHOOL",
          amount: sub.price,
          description: `Cuota ${sub.month}/${sub.year} - ${st?.name || "Alumno"}`,
          payment_method: data.paymentMethod,
          reference_id: paymentId,
        });

        if (movErr) throw movErr;
      }
    }

    return { success: true };
  },
  zod$({
    subscriptionId: z.string(),
    paymentMethod: z.enum(["CASH", "TRANSFER", "CARD", "MERCADO_PAGO", "NONE"]),
  }),
);

export default component$(() => {
  const data = useStudentDetailsData();
  const generateSubAction = useGenerateSubscriptionAction();
  const paySubAction = usePaySubscriptionAction();
  const student = data.value.student;

  useStyles$(`
    @media print {
      body * { visibility: hidden; }
      .print-area, .print-area * { visibility: visible; }
      .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0px; }
      .no-print { display: none !important; }
      @page { margin: 15mm; }
    }
  `);

  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  return (
    <div class="min-h-full bg-slate-50 p-6 font-sans">
      <div class="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div class="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Link
            href="/admin/escuelita/"
            class="rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <div class="flex-1">
            <h1 class="text-3xl font-black tracking-tight text-slate-800">
              {student.name}
            </h1>
            <div class="mt-2 flex gap-4">
              <span class="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                Cat: {student.category || "N/A"}
              </span>
              <span class="flex items-center gap-1 text-xs text-slate-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Tutor: {student.guardianName || "N/A"}{" "}
                {student.guardianPhone ? `(${student.guardianPhone})` : ""}
              </span>
            </div>
          </div>
          <button
            onClick$={() => window.print()}
            class="no-print flex items-center gap-2 rounded-xl bg-slate-800 p-3 text-xs font-bold tracking-widest text-white uppercase shadow-lg transition-all hover:bg-slate-900"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            Imprimir Ficha
          </button>
        </div>

        <div class="print-area hidden space-y-8 bg-white print:block">
          <div class="flex items-center justify-between border-b-4 border-slate-900 pb-6">
            <div>
              <h1 class="text-4xl font-black tracking-tighter text-slate-900 uppercase">
                Ficha del Alumno
              </h1>
              <p class="text-sm font-bold tracking-widest text-emerald-600 uppercase">
                Escuelita - GardenClubFutbol
              </p>
            </div>
            <div class="text-right">
              <p class="text-sm font-black text-slate-500 uppercase">
                Fecha de Emisión
              </p>
              <p class="text-xl font-bold">
                {new Date().toLocaleDateString("es-AR")}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-12">
            <div class="space-y-4">
              <h3 class="border-b pb-1 text-xs font-black tracking-widest text-slate-400 uppercase">
                Datos del Alumno
              </h3>
              <div class="space-y-2">
                <p class="text-sm font-bold text-slate-500 uppercase">
                  Nombre Completo
                </p>
                <p class="text-2xl font-black text-slate-900">{student.name}</p>
              </div>
              <div class="space-y-2">
                <p class="text-sm font-bold text-slate-500 uppercase">
                  Categoría / Escuelita
                </p>
                <p class="text-xl font-black text-emerald-700 uppercase">
                  {student.category || "Sin Asignar"}
                </p>
              </div>
              <div class="space-y-2">
                <p class="text-sm font-bold text-slate-500 uppercase">
                  Fecha de Nacimiento
                </p>
                <p class="text-xl font-bold text-slate-800">
                  {student.birthDate
                    ? new Date(student.birthDate).toLocaleDateString("es-AR")
                    : "-"}
                </p>
              </div>
            </div>
            <div class="space-y-4">
              <h3 class="border-b pb-1 text-xs font-black tracking-widest text-slate-400 uppercase">
                Responsable / Tutor
              </h3>
              <div class="space-y-2">
                <p class="text-sm font-bold text-slate-500 uppercase">
                  Nombre del Tutor
                </p>
                <p class="text-xl font-black text-slate-900">
                  {student.guardianName || "-"}
                </p>
              </div>
              <div class="space-y-2">
                <p class="text-sm font-bold text-slate-500 uppercase">
                  Teléfono de Contacto
                </p>
                <p class="text-xl font-bold text-slate-800">
                  {student.guardianPhone || "-"}
                </p>
              </div>
              <div class="space-y-2">
                <p class="text-sm font-bold text-slate-500 uppercase">
                  Correo Electrónico
                </p>
                <p class="text-md font-bold text-slate-800">
                  {student.guardianEmail || "-"}
                </p>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <h3 class="border-b pb-1 text-xs font-black tracking-widest text-slate-400 uppercase">
              Estado de Cuenta / Pagos
            </h3>
            <table class="w-full border-collapse">
              <thead>
                <tr class="border-b-2 border-slate-200 bg-slate-50">
                  <th class="p-3 text-left text-[10px] font-black text-slate-500 uppercase">
                    Período
                  </th>
                  <th class="p-3 text-left text-[10px] font-black text-slate-500 uppercase">
                    Monto
                  </th>
                  <th class="p-3 text-center text-[10px] font-black text-slate-500 uppercase">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.value.subscriptions.slice(0, 12).map((sub) => (
                  <tr key={sub.id} class="border-b border-slate-100">
                    <td class="p-3 text-sm font-bold text-slate-800">
                      {monthNames[sub.month - 1]} {sub.year}
                    </td>
                    <td class="p-3 text-sm font-bold text-slate-600">
                      ${sub.price.toLocaleString()}
                    </td>
                    <td class="p-3 text-center">
                      <span
                        class={`text-[10px] font-black uppercase ${sub.status === "PAID" ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {sub.status === "PAID" ? "PAGADO" : "PENDIENTE"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div class="mt-20 flex justify-between gap-12">
            <div class="flex-1 border-t-2 border-slate-300 pt-4 text-center">
              <p class="text-[10px] font-black text-slate-400 uppercase">
                Firma del Responsable
              </p>
            </div>
            <div class="flex-1 border-t-2 border-slate-300 pt-4 text-center">
              <p class="text-[10px] font-black text-slate-400 uppercase">
                Firma Administración
              </p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Generate Subscription */}
          <div class="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-1">
            <h2 class="mb-4 text-xl font-black text-slate-800">
              Generar Cuota
            </h2>
            <Form action={generateSubAction} class="space-y-4">
              <input type="hidden" name="studentId" value={student.id} />

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Mes
                  </label>
                  <select
                    name="month"
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    {monthNames.map((m, i) => (
                      <option
                        key={i + 1}
                        value={i + 1}
                        selected={currentMonth === i + 1}
                      >
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Año
                  </label>
                  <input
                    type="number"
                    name="year"
                    value={currentYear}
                    required
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Valor de Cuota ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="price"
                  required
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <Button
                look="primary"
                type="submit"
                disabled={generateSubAction.isRunning}
                class="mt-2 w-full rounded-xl bg-slate-800 py-3 font-bold text-white hover:bg-slate-900"
              >
                {generateSubAction.isRunning ? "Generando..." : "Generar"}
              </Button>
            </Form>
          </div>

          {/* Subscriptions List */}
          <div class="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:col-span-2">
            <div class="border-b border-slate-100 bg-slate-50/50 p-6">
              <h2 class="text-xl font-black text-slate-800">
                Estado de Cuotas
              </h2>
            </div>
            <div class="flex-1 overflow-auto p-0">
              <table class="w-full border-collapse text-left">
                <thead>
                  <tr class="border-b border-slate-200 bg-slate-50/80 text-xs font-black tracking-widest text-slate-400 uppercase">
                    <th class="p-4">Período</th>
                    <th class="p-4">Monto</th>
                    <th class="p-4">Estado</th>
                    <th class="p-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody class="text-sm font-semibold text-slate-700">
                  {data.value.subscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={4} class="p-8 text-center text-slate-500">
                        No hay cuotas generadas para este alumno.
                      </td>
                    </tr>
                  ) : (
                    data.value.subscriptions.map((sub) => (
                      <tr
                        key={sub.id}
                        class="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/50"
                      >
                        <td class="p-4 font-black">
                          {monthNames[sub.month - 1]} {sub.year}
                        </td>
                        <td class="p-4 font-bold text-slate-600">
                          ${sub.price.toFixed(2)}
                        </td>
                        <td class="p-4">
                          <span
                            class={`rounded-md px-2 py-1 text-xs font-bold ${sub.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
                          >
                            {sub.status === "PAID" ? "PAGADO" : "PENDIENTE"}
                          </span>
                        </td>
                        <td class="p-4 text-right">
                          {sub.status === "PENDING" && (
                            <Form
                              action={paySubAction}
                              class="flex items-center justify-end gap-2"
                            >
                              <input
                                type="hidden"
                                name="subscriptionId"
                                value={sub.id}
                              />
                              <select
                                name="paymentMethod"
                                class="w-[120px] rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 uppercase focus:border-emerald-500 focus:outline-none"
                              >
                                <option value="CASH">Efectivo</option>
                                <option value="TRANSFER">Transferencia</option>
                                <option value="MERCADO_PAGO">
                                  Mercado Pago
                                </option>
                                <option value="CARD">Tarjeta</option>
                                <option value="NONE">Sin Caja</option>
                              </select>
                              <Button
                                look="primary"
                                type="submit"
                                disabled={paySubAction.isRunning}
                                class="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold tracking-wide text-white hover:bg-emerald-600"
                              >
                                Cobrar
                              </Button>
                            </Form>
                          )}
                          {sub.status === "PAID" && (
                            <span class="text-xs font-bold text-slate-400 uppercase">
                              Abonado
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export const head = {
  title: "Detalles del Alumno - GardenClubFutbol",
};
