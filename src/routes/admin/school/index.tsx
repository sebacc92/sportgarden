import { component$, useSignal, useComputed$, $ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, Link, useLocation, useNavigate } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { students, siteSettings, studentSubscriptions, studentPayments, cashRegisters, cashMovements } from "~/db/schema";
import { desc, eq, count } from "drizzle-orm";
import { Button, Modal } from "~/components/ui";
import { cn } from "@qwik-ui/utils";
import { LuTrash2, LuRefreshCw, LuChevronLeft, LuChevronRight } from "@qwikest/icons/lucide";

export const useStudentsData = routeLoader$(async (event) => {
  const db = getDB(event);
  const url = event.url;
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 10;
  const offset = (page - 1) * limit;

  // Get total count
  const allStudentsCount = await db.select({ value: count() }).from(students);
  const totalCount = allStudentsCount[0].value;

  const paginatedStudents = await db.query.students.findMany({
    orderBy: [desc(students.createdAt)],
    limit,
    offset,
    with: {
      subscriptions: {
        orderBy: [desc(studentSubscriptions.createdAt)],
        limit: 1,
      }
    }
  });

  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, 1),
  });

  const categories = (settings?.schoolCategories as any[]) || [];

  return {
    students: paginatedStudents,
    categories,
    pagination: {
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    }
  };
});

export const useSeedStudentsAction = routeAction$(async (_, event) => {
  const db = getDB(event);

  // Get categories
  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, 1),
  });

  const categories = (settings?.schoolCategories as any[]) || [];
  if (categories.length === 0) return { success: false, message: "No hay categorías creadas." };

  // Delete current students
  await db.delete(students);

  const exampleNames = [
    "Enzo Fernandez", "Nico Sanchez", "Facu Diaz", "Leo Messi", "Juli Alvarez",
    "Mateo Garcia", "Santi Lopez", "Tiziano Rodriguez", "Joaquin Martinez", "Juan Perez",
    "Agustin Gomez", "Lautaro Martinez", "Angel Di Maria", "Rodrigo De Paul", "Cristian Romero",
    "Lisandro Martinez", "Nahuel Molina", "Emiliano Martinez", "Gonzalo Montiel", "Alexis Mac Allister"
  ];

  for (let i = 0; i < exampleNames.length; i++) {
    const category = categories[i % categories.length];
    await db.insert(students).values({
      id: crypto.randomUUID(),
      name: exampleNames[i],
      guardianName: "Tutor " + (i + 1),
      guardianPhone: "11" + Math.floor(10000000 + Math.random() * 90000000),
      category: category.name,
      monthlyFee: 15000 + (Math.floor(Math.random() * 5) * 1000), // Ej: 15k, 16k, etc.
      birthDate: new Date(2010 + (i % 5), 0, 1),
      createdAt: new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
    });
  }

  return { success: true };
});

export const useCreateCategoryAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const settings = await db.query.siteSettings.findFirst({
      where: eq(siteSettings.id, 1),
    });

    const categories = (settings?.schoolCategories as any[]) || [];
    categories.push({
      id: crypto.randomUUID(),
      name: data.name,
      teacher: data.teacher,
      monthlyFee: data.monthlyFee || 0,
    });

    await db.update(siteSettings).set({ schoolCategories: categories }).where(eq(siteSettings.id, 1));
    return { success: true };
  },
  zod$({
    name: z.string().min(1),
    teacher: z.string().min(1),
    monthlyFee: z.coerce.number().min(0),
  })
);

export const useUpdateCategoryAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const settings = await db.query.siteSettings.findFirst({
      where: eq(siteSettings.id, 1),
    });

    const categories = (settings?.schoolCategories as any[]) || [];
    const idx = categories.findIndex((c: any) => c.id === data.id);
    if (idx !== -1) {
      categories[idx] = { 
        ...categories[idx], 
        name: data.name, 
        teacher: data.teacher,
        monthlyFee: data.monthlyFee || 0
      };
      await db.update(siteSettings).set({ schoolCategories: categories }).where(eq(siteSettings.id, 1));
    }
    return { success: true };
  },
  zod$({
    id: z.string(),
    name: z.string().min(1),
    teacher: z.string().min(1),
    monthlyFee: z.coerce.number().min(0),
  })
);

export const useDeleteCategoryAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const settings = await db.query.siteSettings.findFirst({
      where: eq(siteSettings.id, 1),
    });

    let categories = (settings?.schoolCategories as any[]) || [];
    categories = categories.filter((c: any) => c.id !== data.id);
    await db.update(siteSettings).set({ schoolCategories: categories }).where(eq(siteSettings.id, 1));
    return { success: true };
  },
  zod$({
    id: z.string(),
  })
);

export const useCreateStudentAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    // 1. Get Category Fee from settings
    const settings = await db.query.siteSettings.findFirst({
      where: eq(siteSettings.id, 1),
    });
    const categories = (settings?.schoolCategories as any[]) || [];
    const category = categories.find(c => c.name === data.category);
    const fee = category?.monthlyFee || 0;

    // 2. Check for open cash register
    const openRegister = await db.query.cashRegisters.findFirst({
      where: eq(cashRegisters.status, "OPEN"),
    });

    if (!openRegister) {
      return { success: false, message: "Debe abrir la caja antes de inscribir un alumno (requiere cobro de primera cuota)." };
    }

    const studentId = crypto.randomUUID();
    const now = new Date();

    // 3. Insert Student
    await db.insert(students).values({
      id: studentId,
      name: data.name,
      guardianName: data.guardianName,
      guardianPhone: data.guardianPhone,
      guardianEmail: data.guardianEmail,
      category: data.category,
      monthlyFee: fee,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
    });

    // 4. Create first subscription (Paid)
    const subscriptionId = crypto.randomUUID();
    const nextDueDate = new Date();
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);

    await db.insert(studentSubscriptions).values({
      id: subscriptionId,
      studentId,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      price: fee,
      status: "PAID",
      dueDate: nextDueDate,
    });

    // 5. Create payment record
    const paymentId = crypto.randomUUID();
    await db.insert(studentPayments).values({
      id: paymentId,
      subscriptionId,
      amount: fee,
      paymentMethod: "CASH",
      paymentDate: now,
    });

    // 6. Register in Cash Movement
    await db.insert(cashMovements).values({
      id: crypto.randomUUID(),
      registerId: openRegister.id,
      type: "INCOME",
      category: "SCHOOL",
      amount: fee,
      description: `Inscripción y 1ra cuota: ${data.name} (${data.category})`,
      paymentMethod: "CASH",
      referenceId: studentId, // Using studentId as reference for school movements
    });

    return { success: true };
  },
  zod$({
    name: z.string().min(1),
    guardianName: z.string().optional(),
    guardianPhone: z.string().optional(),
    guardianEmail: z.string().email().optional().or(z.literal("")),
    category: z.string().min(1),
    birthDate: z.string().optional(),
  })
);

export const usePayFeeAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const now = new Date();

    // 1. Get student and open register
    const student = await db.query.students.findFirst({
      where: eq(students.id, data.studentId),
    });
    if (!student) return { success: false, message: "Alumno no encontrado." };

    const openRegister = await db.query.cashRegisters.findFirst({
      where: eq(cashRegisters.status, "OPEN"),
    });
    if (!openRegister) return { success: false, message: "Debe abrir la caja para registrar el pago." };

    // 2. Create new subscription
    const subscriptionId = crypto.randomUUID();
    const nextDueDate = new Date();
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);

    await db.insert(studentSubscriptions).values({
      id: subscriptionId,
      studentId: student.id,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      price: student.monthlyFee,
      status: "PAID",
      dueDate: nextDueDate,
    });

    // 3. Create payment record
    await db.insert(studentPayments).values({
      id: crypto.randomUUID(),
      subscriptionId,
      amount: student.monthlyFee,
      paymentMethod: "CASH",
      paymentDate: now,
    });

    // 4. Register in Cash
    await db.insert(cashMovements).values({
      id: crypto.randomUUID(),
      registerId: openRegister.id,
      type: "INCOME",
      category: "SCHOOL",
      amount: student.monthlyFee,
      description: `Pago de cuota: ${student.name} (${student.category})`,
      paymentMethod: "CASH",
      referenceId: student.id,
    });

    return { success: true };
  },
  zod$({
    studentId: z.string(),
  })
);

export const useDeleteStudentAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    await db.delete(students).where(eq(students.id, data.id));
    return { success: true };
  },
  zod$({
    id: z.string(),
  })
);

export default component$(() => {
  const studentsData = useStudentsData();
  const createStudentAction = useCreateStudentAction();
  const payFeeAction = usePayFeeAction();
  const deleteStudentAction = useDeleteStudentAction();
  const seedStudentsAction = useSeedStudentsAction();

  const loc = useLocation();
  const nav = useNavigate();

  const changePage = $((newPage: number) => {
    const url = new URL(loc.url.href);
    url.searchParams.set("page", newPage.toString());
    nav(url.pathname + url.search);
  });

  const createCategoryAction = useCreateCategoryAction();
  const updateCategoryAction = useUpdateCategoryAction();
  const deleteCategoryAction = useDeleteCategoryAction();

  const isCategoryModalOpen = useSignal(false);
  const editingCategoryId = useSignal<string | null>(null);
  const categoryFormName = useSignal("");
  const categoryFormTeacher = useSignal("");
  const categoryFormFee = useSignal(0);

  const isStudentModalOpen = useSignal(false);

  const selectedCategory = useSignal<string | null>(null);

  const filteredStudents = useComputed$(() => {
    if (!selectedCategory.value) return studentsData.value.students;
    return studentsData.value.students.filter(s => s.category === selectedCategory.value);
  });

  return (
    <div class="p-6 bg-slate-50 min-h-full font-sans">
      <div class="max-w-6xl mx-auto space-y-6">

        <div class="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200 gap-4">
          <div class="flex items-center gap-4">
            <div>
              <h1 class="text-3xl font-black tracking-tight text-slate-800">Escuelita</h1>
              <p class="text-slate-500 mt-1">Gestión de alumnos y cuotas mensuales.</p>
            </div>
            <Form action={seedStudentsAction}>
              <button
                type="submit"
                class={cn("p-2 text-slate-300 hover:text-emerald-500 transition-all hover:rotate-180 duration-500", seedStudentsAction.isRunning && "animate-spin text-emerald-500")}
                title="Cargar alumnos de ejemplo"
              >
                <LuRefreshCw class="w-5 h-5" />
              </button>
            </Form>
          </div>
          <Button look="primary" onClick$={() => isStudentModalOpen.value = true} class="bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl font-bold py-3 px-6 shadow-md shadow-emerald-100 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="16" y1="11" x2="22" y2="11" /></svg>
            Inscribir Alumno
          </Button>
        </div>

        <div class="space-y-6">

          {/* Students List */}
          <div class="space-y-6 flex flex-col">

            {/* Categorías Management & Filter */}
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-black text-slate-800 flex items-center gap-2">
                  Categorías
                  <span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase tracking-widest">{studentsData.value.categories.length}</span>
                  {selectedCategory.value && (
                    <button 
                      onClick$={() => selectedCategory.value = null}
                      class="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-md uppercase tracking-widest font-bold hover:bg-emerald-600 transition-colors flex items-center gap-1 shadow-sm shadow-emerald-100 ml-2"
                    >
                      Todos los alumnos ✕
                    </button>
                  )}
                </h2>
                <Button look="primary" onClick$={() => { editingCategoryId.value = null; categoryFormName.value = ""; categoryFormTeacher.value = ""; categoryFormFee.value = 0; isCategoryModalOpen.value = true; }} class="bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl font-bold py-2 px-4 text-[11px] uppercase tracking-wider shadow-sm">
                  + Nueva
                </Button>
              </div>

              {studentsData.value.categories.length === 0 ? (
                <p class="text-sm text-slate-500 text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">No hay categorías creadas. Usa el botón de arriba para agregar una.</p>
              ) : (
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {studentsData.value.categories.map((cat: any) => (
                    <div
                      key={cat.id}
                      class={cn(
                        "px-4 py-3 rounded-xl border transition-all relative group flex flex-col justify-between",
                        selectedCategory.value === cat.name
                          ? "border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100/50"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <button
                        onClick$={() => selectedCategory.value = cat.name}
                        class="text-left w-full focus:outline-none"
                      >
                        <div class="font-black text-sm text-slate-800">{cat.name}</div>
                        <div class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 max-w-[80%] truncate">Prof: {cat.teacher}</div>
                        <div class="text-[10px] text-emerald-600 font-black mt-1 uppercase tracking-tighter">${cat.monthlyFee?.toLocaleString("es-AR")} / mes</div>
                      </button>
                      <div class="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick$={() => {
                            editingCategoryId.value = cat.id;
                            categoryFormName.value = cat.name;
                            categoryFormTeacher.value = cat.teacher;
                            categoryFormFee.value = cat.monthlyFee || 0;
                            isCategoryModalOpen.value = true;
                          }}
                          class="p-1.5 bg-white text-slate-400 hover:text-emerald-600 rounded-md border border-slate-200 shadow-sm transition-colors"
                          title="Editar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                        </button>
                        <button
                          type="button"
                          class="p-1.5 bg-white text-slate-400 hover:text-red-600 rounded-md border border-slate-200 shadow-sm transition-colors"
                          title="Eliminar"
                          onClick$={() => {
                            if (window.confirm(`¿Eliminar la categoría "${cat.name}"? Los alumnos mantendrán este nombre en sus registros.`)) {
                              deleteCategoryAction.submit({ id: cat.id });
                            }
                          }}
                        >
                          <LuTrash2 class="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                <table class="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr class="bg-slate-50/80 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                      <th class="p-4">Alumno</th>
                      <th class="p-4">Categoría</th>
                      <th class="p-4">Cuota</th>
                      <th class="p-4 text-center">Estado</th>
                      <th class="p-4 text-center">Ingreso</th>
                      <th class="p-4">Tutor</th>
                      <th class="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="text-sm font-semibold text-slate-700">
                    {filteredStudents.value.length === 0 ? (
                      <tr>
                        <td colSpan={7} class="p-8 text-center text-slate-500">
                          {selectedCategory.value ? `No hay alumnos en la categoría "${selectedCategory.value}".` : "No hay alumnos inscriptos."}
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.value.map((s) => (
                        <tr key={s.id} class="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                          <td class="p-4">
                            <div class="font-black text-slate-800">{s.name}</div>
                          </td>
                          <td class="p-4">
                            <span class="px-2 py-1 bg-slate-100 rounded-md text-xs font-bold text-slate-600">{s.category || "Sin asignar"}</span>
                          </td>
                          <td class="p-4">
                            <div class="font-black text-slate-800">${s.monthlyFee?.toLocaleString("es-AR")}</div>
                          </td>
                          <td class="p-4 text-center">
                            {(() => {
                               const lastSub = s.subscriptions?.[0];
                              const isPaid = lastSub?.status === "PAID" && lastSub.dueDate && new Date(lastSub.dueDate) > new Date();
                              return isPaid ? (
                                <span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-wider">Pagado</span>
                              ) : (
                                <span class="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-wider">Vencido</span>
                              );
                            })()}
                          </td>
                          <td class="p-4 text-center">
                            <div class="text-xs font-bold text-slate-500">{new Date(s.createdAt).toLocaleDateString("es-AR")}</div>
                          </td>
                          <td class="p-4 text-slate-500">
                            <div>{s.guardianName || "-"}</div>
                            <div class="text-[10px] text-slate-400">{s.guardianPhone}</div>
                          </td>
                          <td class="p-4 text-center">
                            <div class="flex items-center justify-center gap-2">
                              {(() => {
                                const lastSub = s.subscriptions?.[0];
                                const isPaid = lastSub?.status === "PAID" && lastSub.dueDate && new Date(lastSub.dueDate) > new Date();
                                if (!isPaid) {
                                  return (
                                    <button
                                      onClick$={() => payFeeAction.submit({ studentId: s.id })}
                                      disabled={payFeeAction.isRunning}
                                      class="text-amber-600 hover:text-white hover:bg-amber-500 font-bold text-[10px] uppercase tracking-widest border border-amber-200 px-3 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                                    >
                                      {payFeeAction.isRunning ? "..." : "Cobrar Cuota"}
                                    </button>
                                  );
                                }
                                return (
                                  <Link href={`/admin/school/${s.id}/`} class="text-emerald-600 hover:text-emerald-700 font-bold text-xs uppercase tracking-wider bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">
                                    Ficha
                                  </Link>
                                );
                              })()}
                              <button
                                type="button"
                                class="p-2 text-slate-400 hover:text-red-600 transition-colors bg-slate-50 hover:bg-red-50 rounded-lg border border-slate-200"
                                onClick$={() => {
                                  if (window.confirm(`¿Estás seguro de que deseas eliminar a ${s.name}? Esta acción no se puede deshacer.`)) {
                                    deleteStudentAction.submit({ id: s.id });
                                  }
                                }}
                              >
                                <LuTrash2 class="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Pagination Footer */}
                {studentsData.value.pagination.totalPages > 1 && (
                  <div class="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div class="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                      Mostrando <span class="text-slate-900">{studentsData.value.students.length}</span> de <span class="text-slate-900">{studentsData.value.pagination.totalCount}</span> alumnos
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        disabled={studentsData.value.pagination.currentPage <= 1}
                        onClick$={() => changePage(studentsData.value.pagination.currentPage - 1)}
                        class="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-40 hover:border-emerald-500 hover:text-emerald-600 transition-all active:scale-90"
                      >
                        <LuChevronLeft class="w-4 h-4" />
                      </button>
                      <div class="flex items-center gap-1">
                        {Array.from({ length: studentsData.value.pagination.totalPages }).map((_, i) => {
                          const p = i + 1;
                          const isCurrent = p === studentsData.value.pagination.currentPage;
                          return (
                            <button
                              key={p}
                              onClick$={() => changePage(p)}
                              class={cn(
                                "w-8 h-8 rounded-lg text-xs font-black transition-all",
                                isCurrent ? "bg-emerald-500 text-white shadow-md shadow-emerald-100" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"
                              )}
                            >
                              {p}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        disabled={studentsData.value.pagination.currentPage >= studentsData.value.pagination.totalPages}
                        onClick$={() => changePage(studentsData.value.pagination.currentPage + 1)}
                        class="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-40 hover:border-emerald-500 hover:text-emerald-600 transition-all active:scale-90"
                      >
                        <LuChevronRight class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
            </div>

          </div>
        </div>
      </div>

      {/* Modal para Crear/Editar Categoría */}
      <Modal.Root bind:show={isCategoryModalOpen}>
        <Modal.Panel class="bg-white rounded-2xl shadow-xl w-full max-w-md mx-auto relative overflow-hidden">
          <div class="p-6">
            <h3 class="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
              {editingCategoryId.value ? "Editar Categoría" : "Nueva Categoría"}
            </h3>
            <Form
              action={editingCategoryId.value ? updateCategoryAction : createCategoryAction}
              onSubmitCompleted$={() => {
                const action = editingCategoryId.value ? updateCategoryAction.value : createCategoryAction.value;
                if (action?.success) {
                  isCategoryModalOpen.value = false;
                }
              }}
              class="space-y-4"
            >
              {editingCategoryId.value && <input type="hidden" name="id" value={editingCategoryId.value} />}
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre de la Categoría *</label>
                <input type="text" name="name" bind:value={categoryFormName} required placeholder="Ej: 2012/2013" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Profesor a Cargo *</label>
                <input type="text" name="teacher" bind:value={categoryFormTeacher} required placeholder="Ej: Juan Pérez" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cuota Mensual ($) *</label>
                <input type="number" name="monthlyFee" bind:value={categoryFormFee} required placeholder="0.00" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-bold text-emerald-600" />
              </div>
              <div class="flex justify-end gap-3 pt-4 mt-6 border-t border-slate-100">
                <Button type="button" onClick$={() => isCategoryModalOpen.value = false} look="ghost" class="font-bold text-slate-500 hover:bg-slate-100 rounded-xl px-4 py-2">
                  Cancelar
                </Button>
                <Button type="submit" look="primary" class="font-bold bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl px-6 py-2 shadow-sm shadow-emerald-200">
                  {editingCategoryId.value ? "Guardar Cambios" : "Crear Categoría"}
                </Button>
              </div>
            </Form>
          </div>
        </Modal.Panel>
      </Modal.Root>

      {/* Modal para Inscribir Alumno */}
      <Modal.Root bind:show={isStudentModalOpen}>
        <Modal.Panel class="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-auto relative overflow-hidden">
          <div class="p-6">
            <div class="flex justify-between items-center mb-6">
              <h3 class="text-xl font-black text-slate-800">Inscribir Alumno</h3>
              <button onClick$={() => isStudentModalOpen.value = false} class="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {createStudentAction.value?.message && !createStudentAction.value.success && (
              <div class="mb-4 p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl animate-shake">
                ⚠️ {createStudentAction.value.message}
              </div>
            )}

            <Form action={createStudentAction} class="space-y-4" onSubmitCompleted$={() => { if (createStudentAction.value?.success) isStudentModalOpen.value = false; }}>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="col-span-full">
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre Completo *</label>
                  <input type="text" name="name" required class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha de Nacimiento</label>
                  <input type="date" name="birthDate" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Categoría</label>
                  <select name="category" required class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-bold">
                    <option value="">Seleccionar categoría *</option>
                      {studentsData.value.categories.map((c: any) => (
                        <option key={c.id} value={c.name}>{`${c.name} ($${c.monthlyFee?.toLocaleString()})`}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div class="border-t border-slate-100 pt-4 mt-2">
                <h3 class="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">Datos del Tutor</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre del Tutor</label>
                    <input type="text" name="guardianName" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm" />
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Teléfono</label>
                    <input type="text" name="guardianPhone" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm" />
                  </div>
                </div>
              </div>

              <div class="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-100">
                <Button type="button" onClick$={() => isStudentModalOpen.value = false} look="ghost" class="font-bold text-slate-500 hover:bg-slate-100 rounded-xl px-4 py-2">
                  Cancelar
                </Button>
                <Button look="primary" type="submit" disabled={createStudentAction.isRunning} class="py-2.5 px-6 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl font-bold">
                  {createStudentAction.isRunning ? "Inscribiendo..." : "Inscribir Alumno"}
                </Button>
              </div>
            </Form>
          </div>
        </Modal.Panel>
      </Modal.Root>

    </div>
  );
});

export const head = {
  title: "Escuelita - SportGardenFutbol",
};
