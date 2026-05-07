import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, Link } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { students, studentSubscriptions, studentPayments, cashRegisters, cashMovements } from "~/db/schema";
import { eq, desc } from "drizzle-orm";
import { Button } from "~/components/ui";

export const useStudentDetailsData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const studentId = requestEvent.params.id;
  
  const student = await db.query.students.findFirst({
    where: eq(students.id, studentId),
  });

  if (!student) {
    throw requestEvent.redirect(302, "/admin/school/");
  }

  const subscriptions = await db.query.studentSubscriptions.findMany({
    where: eq(studentSubscriptions.studentId, studentId),
    orderBy: [desc(studentSubscriptions.year), desc(studentSubscriptions.month)],
  });

  return {
    student,
    subscriptions,
  };
});

export const useGenerateSubscriptionAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    
    await db.insert(studentSubscriptions).values({
      id: crypto.randomUUID(),
      studentId: data.studentId,
      month: Number(data.month),
      year: Number(data.year),
      price: Number(data.price),
      status: "PENDING",
    });
    
    return { success: true };
  },
  zod$({
    studentId: z.string(),
    month: z.string(),
    year: z.string(),
    price: z.string(),
  })
);

export const usePaySubscriptionAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const subscriptionId = data.subscriptionId;

    const sub = await db.query.studentSubscriptions.findFirst({
      where: eq(studentSubscriptions.id, subscriptionId),
      with: { student: true } // Need this relation in schema or fetch separately
    });

    if (!sub) return { success: false, message: "Cuota no encontrada" };

    // We fetch student manually since relation might not be defined explicitly in query
    const st = await db.query.students.findFirst({ where: eq(students.id, sub.studentId) });

    await db.update(studentSubscriptions).set({ status: "PAID" }).where(eq(studentSubscriptions.id, subscriptionId));

    const paymentId = crypto.randomUUID();
    await db.insert(studentPayments).values({
      id: paymentId,
      subscriptionId: subscriptionId,
      amount: sub.price,
      paymentMethod: data.paymentMethod as any,
    });

    // Impact open cash register
    if (data.paymentMethod && data.paymentMethod !== "NONE") {
      const openRegister = await db.query.cashRegisters.findFirst({
        where: eq(cashRegisters.status, "OPEN"),
        orderBy: [desc(cashRegisters.openedAt)],
      });

      if (openRegister) {
        await db.insert(cashMovements).values({
          id: crypto.randomUUID(),
          registerId: openRegister.id,
          type: "INCOME",
          category: "SCHOOL",
          amount: sub.price,
          description: `Cuota ${sub.month}/${sub.year} - ${st?.name || 'Alumno'}`,
          paymentMethod: data.paymentMethod as any,
          referenceId: paymentId,
        });
      }
    }
    
    return { success: true };
  },
  zod$({
    subscriptionId: z.string(),
    paymentMethod: z.enum(["CASH", "TRANSFER", "CARD", "MERCADO_PAGO", "NONE"]),
  })
);

export default component$(() => {
  const data = useStudentDetailsData();
  const generateSubAction = useGenerateSubscriptionAction();
  const paySubAction = usePaySubscriptionAction();
  const student = data.value.student;

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  return (
    <div class="p-6 bg-slate-50 min-h-full font-sans">
      <div class="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div class="flex items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <Link href="/admin/school/" class="p-2 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <div class="flex-1">
            <h1 class="text-3xl font-black tracking-tight text-slate-800">{student.name}</h1>
            <div class="flex gap-4 mt-2">
              <span class="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded">Cat: {student.category || 'N/A'}</span>
              <span class="text-xs text-slate-500 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Tutor: {student.guardianName || 'N/A'} {student.guardianPhone ? `(${student.guardianPhone})` : ''}
              </span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Generate Subscription */}
          <div class="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <h2 class="text-xl font-black text-slate-800 mb-4">Generar Cuota</h2>
            <Form action={generateSubAction} class="space-y-4">
              <input type="hidden" name="studentId" value={student.id} />
              
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mes</label>
                  <select name="month" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-semibold">
                    {monthNames.map((m, i) => (
                      <option key={i+1} value={i+1} selected={currentMonth === i+1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Año</label>
                  <input type="number" name="year" value={currentYear} required class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Valor de Cuota ($)</label>
                <input type="number" step="0.01" name="price" required class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </div>

              <Button look="primary" type="submit" disabled={generateSubAction.isRunning} class="w-full py-3 bg-slate-800 text-white hover:bg-slate-900 rounded-xl font-bold mt-2">
                {generateSubAction.isRunning ? "Generando..." : "Generar"}
              </Button>
            </Form>
          </div>

          {/* Subscriptions List */}
          <div class="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div class="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 class="text-xl font-black text-slate-800">Estado de Cuotas</h2>
            </div>
            <div class="flex-1 overflow-auto p-0">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-slate-50/80 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
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
                      <tr key={sub.id} class="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td class="p-4 font-black">
                          {monthNames[sub.month - 1]} {sub.year}
                        </td>
                        <td class="p-4 text-slate-600 font-bold">${sub.price.toFixed(2)}</td>
                        <td class="p-4">
                          <span class={`px-2 py-1 rounded-md text-xs font-bold ${sub.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {sub.status === "PAID" ? "PAGADO" : "PENDIENTE"}
                          </span>
                        </td>
                        <td class="p-4 text-right">
                          {sub.status === "PENDING" && (
                            <Form action={paySubAction} class="flex justify-end gap-2 items-center">
                              <input type="hidden" name="subscriptionId" value={sub.id} />
                              <select name="paymentMethod" class="px-2 py-1 border border-slate-200 rounded bg-white text-[10px] uppercase font-bold text-slate-600 focus:outline-none focus:border-emerald-500 w-[120px]">
                                <option value="CASH">Efectivo</option>
                                <option value="TRANSFER">Transferencia</option>
                                <option value="MERCADO_PAGO">Mercado Pago</option>
                                <option value="CARD">Tarjeta</option>
                                <option value="NONE">Sin Caja</option>
                              </select>
                              <Button look="primary" type="submit" disabled={paySubAction.isRunning} class="bg-emerald-500 text-white hover:bg-emerald-600 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide">
                                Cobrar
                              </Button>
                            </Form>
                          )}
                          {sub.status === "PAID" && (
                            <span class="text-xs text-slate-400 font-bold uppercase">Abonado</span>
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
  title: "Detalles del Alumno - SportGardenFutbol",
};
