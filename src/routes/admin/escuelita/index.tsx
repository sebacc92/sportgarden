import {
  component$,
  useSignal,
  useComputed$,
  $,
  useStore,
  useStyles$,
} from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  z,
  zod$,
  Link,
  useLocation,
  useNavigate,
} from "@builder.io/qwik-city";
import { getDB, camelize } from "~/db";
import {
  students,
  siteSettings,
  studentSubscriptions,
  studentPayments,
  cashRegisters,
  cashMovements,
  pitches,
} from "~/db/schema";
import { Button, Modal } from "~/components/ui";
import { cn } from "@qwik-ui/utils";
import {
  LuTrash2,
  LuRefreshCw,
  LuChevronLeft,
  LuChevronRight,
} from "@qwikest/icons/lucide";

export const useStudentsData = routeLoader$(async (event) => {
  const db = getDB(event);
  const url = event.url;
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 10;
  const offset = (page - 1) * limit;

  // Get total count
  const { count: totalCount, error: countErr } = await db
    .from(students)
    .select("*", { count: "exact", head: true });

  if (countErr) throw countErr;

  const { data: studentsData, error: studentsErr } = await db
    .from(students)
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (studentsErr) throw studentsErr;
  const camelStudents = camelize<any[]>(studentsData || []);

  if (camelStudents.length > 0) {
    const studentIds = camelStudents.map((s) => s.id);
    const { data: subsData, error: subsErr } = await db
      .from(studentSubscriptions)
      .select("*")
      .in("student_id", studentIds)
      .order("created_at", { ascending: false });

    if (subsErr) throw subsErr;
    const camelSubs = camelize<any[]>(subsData || []);

    // For each student, assign their subscriptions (only the most recent one)
    camelStudents.forEach((s) => {
      s.subscriptions = camelSubs.filter((sub) => sub.studentId === s.id).slice(0, 1);
    });
  }

  const { data: settingsData, error: settingsErr } = await db
    .from(siteSettings)
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (settingsErr) throw settingsErr;
  const settings = camelize<any>(settingsData);

  const categories = (settings?.schoolCategories as any[]) || [];

  const paymentMethods = (settings?.paymentMethods || []) as {
    id: string;
    name: string;
    isActive: boolean;
  }[];

  const { data: pitchesData, error: pitchesErr } = await db
    .from(pitches)
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (pitchesErr) throw pitchesErr;
  const camelPitches = camelize<any[]>(pitchesData || []);

  return {
    students: camelStudents,
    categories,
    pitches: camelPitches,
    paymentMethods:
      paymentMethods.length > 0
        ? paymentMethods
        : [
            { id: "CASH", name: "Efectivo", isActive: true },
            { id: "TRANSFER", name: "Transferencia", isActive: true },
            { id: "CARD", name: "Tarjeta", isActive: true },
            { id: "MERCADO_PAGO", name: "Mercado Pago", isActive: true },
          ],
    pagination: {
      totalCount: totalCount || 0,
      totalPages: Math.ceil((totalCount || 0) / limit),
      currentPage: page,
    },
  };
});

export const useSeedStudentsAction = routeAction$(async (_, event) => {
  const db = getDB(event);

  // Get categories
  const { data: settingsData, error: settingsErr } = await db
    .from(siteSettings)
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (settingsErr) throw settingsErr;
  const settings = camelize<any>(settingsData);

  const categories = (settings?.schoolCategories as any[]) || [];
  if (categories.length === 0)
    return { success: false, message: "No hay categorías creadas." };

  // Delete current students
  const { error: delErr } = await db
    .from(students)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (delErr) throw delErr;

  const exampleNames = [
    "Enzo Fernandez",
    "Nico Sanchez",
    "Facu Diaz",
    "Leo Messi",
    "Juli Alvarez",
    "Mateo Garcia",
    "Santi Lopez",
    "Tiziano Rodriguez",
    "Joaquin Martinez",
    "Juan Perez",
    "Agustin Gomez",
    "Lautaro Martinez",
    "Angel Di Maria",
    "Rodrigo De Paul",
    "Cristian Romero",
    "Lisandro Martinez",
    "Nahuel Molina",
    "Emiliano Martinez",
    "Gonzalo Montiel",
    "Alexis Mac Allister",
  ];

  const insertPayloads = exampleNames.map((name, i) => {
    const category = categories[i % categories.length];
    return {
      id: crypto.randomUUID(),
      name,
      guardian_name: "Tutor " + (i + 1),
      guardian_phone: "11" + Math.floor(10000000 + Math.random() * 90000000),
      category: category.name,
      monthly_fee: 15000 + Math.floor(Math.random() * 5) * 1000,
      birth_date: new Date(2010 + (i % 5), 0, 1).toISOString(),
      created_at: new Date(
        2023,
        Math.floor(Math.random() * 12),
        Math.floor(Math.random() * 28) + 1,
      ).toISOString(),
    };
  });

  const { error: insErr } = await db
    .from(students)
    .insert(insertPayloads);

  if (insErr) throw insErr;

  return { success: true };
});

export const useCreateCategoryAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const { data: settingsData, error: settingsErr } = await db
      .from(siteSettings)
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (settingsErr) throw settingsErr;
    const settings = camelize<any>(settingsData);

    const categories = (settings?.schoolCategories as any[]) || [];
    let parsedSchedules = [];
    try {
      if (data.schedules) {
        parsedSchedules = JSON.parse(data.schedules);
      }
    } catch {
      // Ignoramos errores
    }

    categories.push({
      id: crypto.randomUUID(),
      name: data.name,
      teacher: data.teacher,
      monthlyFee: data.monthlyFee || 0,
      schedules: parsedSchedules,
    });

    const { error: updErr } = await db
      .from(siteSettings)
      .update({ school_categories: categories })
      .eq("id", 1);

    if (updErr) throw updErr;
    return { success: true };
  },
  zod$({
    name: z.string().min(1),
    teacher: z.string().min(1),
    monthlyFee: z.coerce.number().min(0),
    schedules: z.string().optional(),
  }),
);

export const useUpdateCategoryAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const { data: settingsData, error: settingsErr } = await db
      .from(siteSettings)
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (settingsErr) throw settingsErr;
    const settings = camelize<any>(settingsData);

    const categories = (settings?.schoolCategories as any[]) || [];
    let parsedSchedules = [];
    try {
      if (data.schedules) {
        parsedSchedules = JSON.parse(data.schedules);
      }
    } catch {
      // Ignoramos errores
    }

    const idx = categories.findIndex((c: any) => c.id === data.id);
    if (idx !== -1) {
      categories[idx] = {
        ...categories[idx],
        name: data.name,
        teacher: data.teacher,
        monthlyFee: data.monthlyFee || 0,
        schedules: parsedSchedules,
        days: undefined,
        startTime: undefined,
        endTime: undefined,
      };
      const { error: updErr } = await db
        .from(siteSettings)
        .update({ school_categories: categories })
        .eq("id", 1);

      if (updErr) throw updErr;
    }
    return { success: true };
  },
  zod$({
    id: z.string(),
    name: z.string().min(1),
    teacher: z.string().min(1),
    monthlyFee: z.coerce.number().min(0),
    schedules: z.string().optional(),
  }),
);

export const useDeleteCategoryAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const { data: settingsData, error: settingsErr } = await db
      .from(siteSettings)
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (settingsErr) throw settingsErr;
    const settings = camelize<any>(settingsData);

    let categories = (settings?.schoolCategories as any[]) || [];
    categories = categories.filter((c: any) => c.id !== data.id);

    const { error: updErr } = await db
      .from(siteSettings)
      .update({ school_categories: categories })
      .eq("id", 1);

    if (updErr) throw updErr;
    return { success: true };
  },
  zod$({
    id: z.string(),
  }),
);

export const useCreateStudentAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    // 1. Get Category Fee from settings
    const { data: settingsData, error: settingsErr } = await db
      .from(siteSettings)
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (settingsErr) throw settingsErr;
    const settings = camelize<any>(settingsData);
    const categories = (settings?.schoolCategories as any[]) || [];
    const category = categories.find((c) => c.name === data.category);
    const fee = category?.monthlyFee || 0;

    // 2. Check for open cash register
    const { data: openRegisterData, error: regErr } = await db
      .from(cashRegisters)
      .select("*")
      .eq("status", "OPEN")
      .maybeSingle();

    if (regErr) throw regErr;
    const openRegister = camelize<any>(openRegisterData);

    if (!openRegister) {
      return {
        success: false,
        message:
          "Debe abrir la caja antes de inscribir un alumno (requiere cobro de primera cuota).",
      };
    }

    const studentId = crypto.randomUUID();
    const now = new Date();

    // 3. Insert Student
    const { error: studErr } = await db.from(students).insert({
      id: studentId,
      name: data.name,
      guardian_name: data.guardianName,
      guardian_phone: data.guardianPhone,
      guardian_email: data.guardianEmail,
      category: data.category,
      monthly_fee: fee,
      birth_date: data.birthDate ? new Date(data.birthDate).toISOString() : null,
    });

    if (studErr) throw studErr;

    // 4. Create first subscription (Paid)
    const subscriptionId = crypto.randomUUID();
    const nextDueDate = new Date();
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);

    const { error: subErr } = await db.from(studentSubscriptions).insert({
      id: subscriptionId,
      student_id: studentId,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      price: fee,
      status: "PAID",
      due_date: nextDueDate.toISOString(),
    });

    if (subErr) throw subErr;

    // 5. Create payment record
    const paymentId = crypto.randomUUID();
    const { error: payErr } = await db.from(studentPayments).insert({
      id: paymentId,
      subscription_id: subscriptionId,
      amount: fee,
      payment_method: data.paymentMethod || "CASH",
      payment_date: now.toISOString(),
    });

    if (payErr) throw payErr;

    // 6. Register in Cash Movement
    const { error: movErr } = await db.from(cashMovements).insert({
      id: crypto.randomUUID(),
      register_id: openRegister.id,
      type: "INCOME",
      category: "SCHOOL",
      amount: fee,
      description: `Inscripción y 1ra cuota: ${data.name} (${data.category})`,
      payment_method: data.paymentMethod || "CASH",
      reference_id: studentId,
    });

    if (movErr) throw movErr;

    return { success: true };
  },
  zod$({
    name: z.string().min(1),
    guardianName: z.string().optional(),
    guardianPhone: z.string().optional(),
    guardianEmail: z.string().email().optional().or(z.literal("")),
    category: z.string().min(1),
    birthDate: z.string().optional(),
    paymentMethod: z.string().optional(),
  }),
);

export const usePayFeeAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const now = new Date();

    // 1. Get student and open register
    const { data: studentData, error: studErr } = await db
      .from(students)
      .select("*")
      .eq("id", data.studentId)
      .maybeSingle();

    if (studErr) throw studErr;
    if (!studentData) return { success: false, message: "Alumno no encontrado." };
    const student = camelize<any>(studentData);

    const { data: openRegisterData, error: regErr } = await db
      .from(cashRegisters)
      .select("*")
      .eq("status", "OPEN")
      .maybeSingle();

    if (regErr) throw regErr;
    const openRegister = camelize<any>(openRegisterData);

    if (!openRegister)
      return {
        success: false,
        message: "Debe abrir la caja para registrar el pago.",
      };

    // 2. Create new subscription
    const subscriptionId = crypto.randomUUID();
    const nextDueDate = new Date();
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);

    const { error: subErr } = await db.from(studentSubscriptions).insert({
      id: subscriptionId,
      student_id: student.id,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      price: student.monthlyFee,
      status: "PAID",
      due_date: nextDueDate.toISOString(),
    });

    if (subErr) throw subErr;

    // 3. Create payment record
    const { error: payErr } = await db.from(studentPayments).insert({
      id: crypto.randomUUID(),
      subscription_id: subscriptionId,
      amount: student.monthlyFee,
      payment_method: data.paymentMethod || "CASH",
      payment_date: now.toISOString(),
    });

    if (payErr) throw payErr;

    // 4. Register in Cash
    const { error: movErr } = await db.from(cashMovements).insert({
      id: crypto.randomUUID(),
      register_id: openRegister.id,
      type: "INCOME",
      category: "SCHOOL",
      amount: student.monthlyFee,
      description: `Pago de cuota: ${student.name} (${student.category})`,
      payment_method: data.paymentMethod || "CASH",
      reference_id: student.id,
    });

    if (movErr) throw movErr;

    return { success: true };
  },
  zod$({
    studentId: z.string(),
    paymentMethod: z.string().optional(),
  }),
);

export const useDeleteStudentAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const { error } = await db
      .from(students)
      .delete()
      .eq("id", data.id);

    if (error) throw error;
    return { success: true };
  },
  zod$({
    id: z.string(),
  }),
);

export default component$(() => {
  const studentsData = useStudentsData();
  const createStudentAction = useCreateStudentAction();
  const payFeeAction = usePayFeeAction();
  const deleteStudentAction = useDeleteStudentAction();
  const seedStudentsAction = useSeedStudentsAction();
  const openPaymentForId = useSignal<string | null>(null);

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
  const categoryFormSchedules = useStore<
    Record<number, { startTime: string; endTime: string; pitchId?: string }>
  >({});

  const adminTimeOptions = useComputed$(() => {
    return Array.from({ length: 32 }, (_, i) => {
      const hours = Math.floor(i / 2) + 8;
      const minutes = i % 2 === 0 ? "00" : "30";
      return `${hours.toString().padStart(2, "0")}:${minutes}`;
    });
  });

  const isPrintModalOpen = useSignal(false);
  const printableDay = useSignal(
    new Date().getDay() === 0 ? 0 : new Date().getDay(),
  ); // 0-6

  const isMonthlyReportModalOpen = useSignal(false);
  const reportCategory = useSignal<string | null>(null);
  const reportMonth = useSignal(new Date().getMonth() + 1);
  const reportYear = useSignal(new Date().getFullYear());

  useStyles$(`
    @media print {
      body * { visibility: hidden; }
      .print-area, .print-area * { visibility: visible; }
      .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0px; }
      .no-print { display: none !important; }
      
      @page {
        size: auto;
        margin: 10mm;
      }
    }
  `);

  const isStudentModalOpen = useSignal(false);

  const selectedCategory = useSignal<string | null>(null);

  const filteredStudents = useComputed$(() => {
    if (!selectedCategory.value) return studentsData.value.students;
    return studentsData.value.students.filter(
      (s) => s.category === selectedCategory.value,
    );
  });

  return (
    <div class="min-h-full bg-slate-50 p-6 font-sans">
      <div class="mx-auto max-w-6xl space-y-6">
        <div class="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center">
          <div class="flex items-center gap-4">
            <div>
              <h1 class="text-3xl font-black tracking-tight text-slate-800">
                Escuelita
              </h1>
              <p class="mt-1 text-slate-500">
                Gestión de alumnos y cuotas mensuales.
              </p>
            </div>
            <Form action={seedStudentsAction}>
              <button
                type="submit"
                class={cn(
                  "p-2 text-slate-300 transition-all duration-500 hover:rotate-180 hover:text-emerald-500",
                  seedStudentsAction.isRunning &&
                    "animate-spin text-emerald-500",
                )}
                title="Cargar alumnos de ejemplo"
              >
                <LuRefreshCw class="h-5 w-5" />
              </button>
            </Form>
          </div>
          <Button
            look="primary"
            onClick$={() => (isStudentModalOpen.value = true)}
            class="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 font-bold text-white shadow-md shadow-emerald-100 transition-all hover:scale-[1.02] hover:bg-emerald-600 active:scale-95"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="16" y1="11" x2="22" y2="11" />
            </svg>
            Inscribir Alumno
          </Button>
        </div>

        <div class="space-y-6">
          {/* Students List */}
          <div class="flex flex-col space-y-6">
            {/* Categorías Management & Filter */}
            <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div class="mb-4 flex items-center justify-between">
                <h2 class="flex items-center gap-2 text-xl font-black text-slate-800">
                  Categorías
                  <span class="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] tracking-widest text-slate-500 uppercase">
                    {studentsData.value.categories.length}
                  </span>
                  {selectedCategory.value && (
                    <button
                      onClick$={() => (selectedCategory.value = null)}
                      class="ml-2 flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-bold tracking-widest text-white uppercase shadow-sm shadow-emerald-100 transition-colors hover:bg-emerald-600"
                    >
                      Todos los alumnos ✕
                    </button>
                  )}
                </h2>
                <div class="flex items-center gap-2">
                  <button
                    onClick$={() => {
                      reportCategory.value = selectedCategory.value;
                      isMonthlyReportModalOpen.value = true;
                    }}
                    class="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-[11px] font-bold tracking-wider text-white uppercase shadow-sm transition-all hover:bg-slate-900"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    Reporte Mensual
                  </button>
                  <button
                    onClick$={() => (isPrintModalOpen.value = true)}
                    class="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-[11px] font-bold tracking-wider text-slate-600 uppercase transition-all hover:bg-slate-200"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
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
                    Horarios
                  </button>
                  <Button
                    look="primary"
                    onClick$={() => {
                      editingCategoryId.value = null;
                      categoryFormName.value = "";
                      categoryFormTeacher.value = "";
                      categoryFormFee.value = 0;
                      // Clear schedules
                      Object.keys(categoryFormSchedules).forEach(
                        (key) => delete categoryFormSchedules[Number(key)],
                      );
                      isCategoryModalOpen.value = true;
                    }}
                    class="rounded-xl bg-emerald-500 px-4 py-2 text-[11px] font-bold tracking-wider text-white uppercase shadow-sm hover:bg-emerald-600"
                  >
                    + Nueva
                  </Button>
                </div>
              </div>

              {studentsData.value.categories.length === 0 ? (
                <p class="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-4 text-center text-sm text-slate-500">
                  No hay categorías creadas. Usa el botón de arriba para agregar
                  una.
                </p>
              ) : (
                <div class="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
                  {studentsData.value.categories.map((cat: any) => (
                    <div
                      key={cat.id}
                      class={cn(
                        "group relative flex flex-col justify-between rounded-xl border px-4 py-3 transition-all",
                        selectedCategory.value === cat.name
                          ? "border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100/50"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                      )}
                    >
                      <button
                        onClick$={() => (selectedCategory.value = cat.name)}
                        class="w-full text-left focus:outline-none"
                      >
                        <div class="text-lg font-black text-slate-800">
                          {cat.name}
                        </div>
                        <div class="mt-0.5 max-w-[90%] truncate text-xs font-bold tracking-widest text-slate-500 uppercase">
                          Prof: {cat.teacher}
                        </div>
                        {(() => {
                          const schedules =
                            cat.schedules ||
                            (cat.days
                              ? cat.days.map((d: number) => ({
                                  day: d,
                                  startTime: cat.startTime,
                                  endTime: cat.endTime,
                                }))
                              : []);
                          if (!schedules || schedules.length === 0) return null;

                          const groups: Record<string, number[]> = {};
                          schedules.forEach((s: any) => {
                            const key = `${s.startTime || "?"}-${s.endTime || "?"}`;
                            if (!groups[key]) groups[key] = [];
                            groups[key].push(s.day);
                          });

                          return (
                            <div class="mt-2 space-y-1">
                              {Object.entries(groups).map(([time, days]) => (
                                <div
                                  key={time}
                                  class="flex items-center gap-1.5"
                                >
                                  <div class="flex gap-1">
                                    {days
                                      .sort((a, b) => a - b)
                                      .map((d) => (
                                        <span
                                          key={d}
                                          class="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-xs font-black text-emerald-700 uppercase"
                                          title={
                                            [
                                              "Dom",
                                              "Lun",
                                              "Mar",
                                              "Mié",
                                              "Jue",
                                              "Vie",
                                              "Sáb",
                                            ][d]
                                          }
                                        >
                                          {
                                            ["D", "L", "M", "M", "J", "V", "S"][
                                              d
                                            ]
                                          }
                                        </span>
                                      ))}
                                  </div>
                                  <div class="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold tracking-tight text-slate-500 uppercase">
                                    {time.replace("-", " - ")}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                        <div class="mt-2 text-sm font-black tracking-tight text-emerald-600 uppercase">
                          ${cat.monthlyFee?.toLocaleString("es-AR")} / mes
                        </div>
                      </button>
                      <div class="absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick$={() => {
                            editingCategoryId.value = cat.id;
                            categoryFormName.value = cat.name;
                            categoryFormTeacher.value = cat.teacher;
                            categoryFormFee.value = cat.monthlyFee || 0;

                            // Clear and load schedules
                            Object.keys(categoryFormSchedules).forEach(
                              (key) =>
                                delete categoryFormSchedules[Number(key)],
                            );
                            if (cat.schedules) {
                              cat.schedules.forEach((s: any) => {
                                categoryFormSchedules[s.day] = {
                                  startTime: s.startTime,
                                  endTime: s.endTime,
                                  pitchId: s.pitchId,
                                };
                              });
                            } else if (cat.days) {
                              // Fallback for old data
                              cat.days.forEach((d: number) => {
                                categoryFormSchedules[d] = {
                                  startTime: cat.startTime || "",
                                  endTime: cat.endTime || "",
                                };
                              });
                            }

                            isCategoryModalOpen.value = true;
                          }}
                          class="rounded-md border border-slate-200 bg-white p-1.5 text-slate-400 shadow-sm transition-colors hover:text-emerald-600"
                          title="Editar"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          class="rounded-md border border-slate-200 bg-white p-1.5 text-slate-400 shadow-sm transition-colors hover:text-red-600"
                          title="Eliminar"
                          onClick$={() => {
                            if (
                              window.confirm(
                                `¿Eliminar la categoría "${cat.name}"? Los alumnos mantendrán este nombre en sus registros.`,
                              )
                            ) {
                              deleteCategoryAction.submit({ id: cat.id });
                            }
                          }}
                        >
                          <LuTrash2 class="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table class="w-full min-w-[700px] border-collapse text-left">
                <thead>
                  <tr class="border-b border-slate-200 bg-slate-50/80 text-xs font-black tracking-widest text-slate-400 uppercase">
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
                        {selectedCategory.value
                          ? `No hay alumnos en la categoría "${selectedCategory.value}".`
                          : "No hay alumnos inscriptos."}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.value.map((s) => (
                      <tr
                        key={s.id}
                        class="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/50"
                      >
                        <td class="p-4">
                          <div class="font-black text-slate-800">{s.name}</div>
                        </td>
                        <td class="p-4">
                          <span
                            class={cn(
                              "rounded-md px-2 py-1 text-[10px] font-black tracking-tighter uppercase shadow-sm",
                              s.category?.includes("Sub")
                                ? "border border-blue-200 bg-blue-100 text-blue-700"
                                : s.category?.includes("Papi")
                                  ? "border border-indigo-200 bg-indigo-100 text-indigo-700"
                                  : "border border-slate-200 bg-slate-100 text-slate-700",
                            )}
                          >
                            {s.category || "Sin asignar"}
                          </span>
                        </td>
                        <td class="p-4">
                          <div class="font-black text-slate-800">
                            ${s.monthlyFee?.toLocaleString("es-AR")}
                          </div>
                        </td>
                        <td class="p-4 text-center">
                          {(() => {
                            const lastSub = s.subscriptions?.[0];
                            const isPaid =
                              lastSub?.status === "PAID" &&
                              lastSub.dueDate &&
                              new Date(lastSub.dueDate) > new Date();
                            return isPaid ? (
                              <span class="rounded-lg bg-emerald-100 px-2 py-1 text-[10px] font-black tracking-wider text-emerald-700 uppercase">
                                Pagado
                              </span>
                            ) : (
                              <span class="rounded-lg bg-amber-100 px-2 py-1 text-[10px] font-black tracking-wider text-amber-700 uppercase">
                                Vencido
                              </span>
                            );
                          })()}
                        </td>
                        <td class="p-4 text-center">
                          <div class="text-xs font-bold text-slate-500">
                            {new Date(s.createdAt).toLocaleDateString("es-AR")}
                          </div>
                        </td>
                        <td class="p-4 text-slate-500">
                          <div>{s.guardianName || "-"}</div>
                          <div class="text-[10px] text-slate-400">
                            {s.guardianPhone}
                          </div>
                        </td>
                        <td class="p-4 text-center">
                          <div class="flex items-center justify-center gap-2">
                            {(() => {
                              const lastSub = s.subscriptions?.[0];
                              const isPaid =
                                lastSub?.status === "PAID" &&
                                lastSub.dueDate &&
                                new Date(lastSub.dueDate) > new Date();
                              if (!isPaid) {
                                return (
                                  <div class="relative">
                                    <button
                                      onClick$={() =>
                                        (openPaymentForId.value =
                                          openPaymentForId.value === s.id
                                            ? null
                                            : s.id)
                                      }
                                      class="rounded-lg border border-amber-200 px-3 py-1.5 text-[10px] font-bold tracking-widest text-amber-600 uppercase transition-all hover:bg-amber-500 hover:text-white active:scale-95 disabled:opacity-50"
                                    >
                                      Cobrar Cuota
                                    </button>
                                    {openPaymentForId.value === s.id && (
                                      <div class="animate-fade-in absolute top-full right-0 z-50 mt-2 min-w-[160px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                                        <p class="mb-1 border-b border-slate-50 p-2 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                                          Medio de Pago
                                        </p>
                                        {studentsData.value.paymentMethods
                                          .filter((pm) => pm.isActive)
                                          .map((pm) => (
                                            <button
                                              key={pm.id}
                                              onClick$={() => {
                                                payFeeAction.submit({
                                                  studentId: s.id,
                                                  paymentMethod: pm.id,
                                                });
                                                openPaymentForId.value = null;
                                              }}
                                              class="w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                                            >
                                              {pm.name}
                                            </button>
                                          ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              return (
                                <Link
                                  href={`/admin/escuelita/${s.id}/`}
                                  class="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold tracking-wider text-emerald-600 uppercase transition-colors hover:text-emerald-700"
                                >
                                  Ficha
                                </Link>
                              );
                            })()}
                            <button
                              type="button"
                              class="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              onClick$={() => {
                                if (
                                  window.confirm(
                                    `¿Estás seguro de que deseas eliminar a ${s.name}? Esta acción no se puede deshacer.`,
                                  )
                                ) {
                                  deleteStudentAction.submit({ id: s.id });
                                }
                              }}
                            >
                              <LuTrash2 class="h-4 w-4" />
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
                <div class="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row">
                  <div class="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                    Mostrando{" "}
                    <span class="text-slate-900">
                      {studentsData.value.students.length}
                    </span>{" "}
                    de{" "}
                    <span class="text-slate-900">
                      {studentsData.value.pagination.totalCount}
                    </span>{" "}
                    alumnos
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      disabled={studentsData.value.pagination.currentPage <= 1}
                      onClick$={() =>
                        changePage(
                          studentsData.value.pagination.currentPage - 1,
                        )
                      }
                      class="rounded-xl border border-slate-200 bg-white p-2 transition-all hover:border-emerald-500 hover:text-emerald-600 active:scale-90 disabled:opacity-40"
                    >
                      <LuChevronLeft class="h-4 w-4" />
                    </button>
                    <div class="flex items-center gap-1">
                      {Array.from({
                        length: studentsData.value.pagination.totalPages,
                      }).map((_, i) => {
                        const p = i + 1;
                        const isCurrent =
                          p === studentsData.value.pagination.currentPage;
                        return (
                          <button
                            key={p}
                            onClick$={() => changePage(p)}
                            class={cn(
                              "h-8 w-8 rounded-lg text-xs font-black transition-all",
                              isCurrent
                                ? "bg-emerald-500 text-white shadow-md shadow-emerald-100"
                                : "border border-slate-200 bg-white text-slate-500 hover:border-slate-300",
                            )}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      disabled={
                        studentsData.value.pagination.currentPage >=
                        studentsData.value.pagination.totalPages
                      }
                      onClick$={() =>
                        changePage(
                          studentsData.value.pagination.currentPage + 1,
                        )
                      }
                      class="rounded-xl border border-slate-200 bg-white p-2 transition-all hover:border-emerald-500 hover:text-emerald-600 active:scale-90 disabled:opacity-40"
                    >
                      <LuChevronRight class="h-4 w-4" />
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
        <Modal.Panel class="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl">
          <div class="p-6">
            <h3 class="mb-6 flex items-center gap-2 text-xl font-black text-slate-800">
              {editingCategoryId.value ? "Editar Categoría" : "Nueva Categoría"}
            </h3>
            <Form
              action={
                editingCategoryId.value
                  ? updateCategoryAction
                  : createCategoryAction
              }
              onSubmitCompleted$={() => {
                const action = editingCategoryId.value
                  ? updateCategoryAction.value
                  : createCategoryAction.value;
                if (action?.success) {
                  isCategoryModalOpen.value = false;
                }
              }}
              class="space-y-4"
            >
              {editingCategoryId.value && (
                <input
                  type="hidden"
                  name="id"
                  value={editingCategoryId.value}
                />
              )}
              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Nombre de la Categoría *
                </label>
                <input
                  type="text"
                  name="name"
                  bind:value={categoryFormName}
                  required
                  placeholder="Ej: 2012/2013"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Profesor a Cargo *
                </label>
                <input
                  type="text"
                  name="teacher"
                  bind:value={categoryFormTeacher}
                  required
                  placeholder="Ej: Juan Pérez"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Cuota Mensual ($) *
                </label>
                <input
                  type="number"
                  name="monthlyFee"
                  bind:value={categoryFormFee}
                  required
                  placeholder="0.00"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 font-bold text-emerald-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div class="mt-2 border-t border-slate-100 pt-4">
                <div class="mb-3 flex items-center justify-between">
                  <h4 class="text-sm font-black text-slate-800">
                    Horarios de Entrenamiento
                  </h4>
                  {Object.keys(categoryFormSchedules).length > 1 && (
                    <button
                      type="button"
                      onClick$={() => {
                        const firstDay = Object.keys(categoryFormSchedules)
                          .map(Number)
                          .sort((a, b) => a - b)[0];
                        if (firstDay !== undefined) {
                          const { startTime, endTime, pitchId } =
                            categoryFormSchedules[firstDay];
                          Object.keys(categoryFormSchedules).forEach((day) => {
                            categoryFormSchedules[Number(day)] = {
                              startTime,
                              endTime,
                              pitchId,
                            };
                          });
                        }
                      }}
                      class="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-black tracking-widest text-emerald-600 uppercase transition-colors hover:text-emerald-700"
                    >
                      Mismo horario para todos
                    </button>
                  )}
                </div>

                <input
                  type="hidden"
                  name="schedules"
                  value={JSON.stringify(
                    Object.entries(categoryFormSchedules).map(([day, val]) => ({
                      day: Number(day),
                      ...val,
                    })),
                  )}
                />

                <div class="mb-4">
                  <label class="mb-2 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                    Días
                  </label>
                  <div class="flex flex-wrap gap-2">
                    {["D", "L", "M", "M", "J", "V", "S"].map((day, idx) => {
                      const isActive = categoryFormSchedules[idx] !== undefined;
                      return (
                        <button
                          type="button"
                          key={idx}
                          onClick$={() => {
                            if (isActive) {
                              delete categoryFormSchedules[idx];
                            } else {
                              categoryFormSchedules[idx] = {
                                startTime: "",
                                endTime: "",
                              };
                            }
                          }}
                          class={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full text-xs font-black transition-all",
                            isActive
                              ? "scale-110 bg-emerald-500 text-white shadow-md shadow-emerald-200"
                              : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600",
                          )}
                          title={
                            [
                              "Domingo",
                              "Lunes",
                              "Martes",
                              "Miércoles",
                              "Jueves",
                              "Viernes",
                              "Sábado",
                            ][idx]
                          }
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div class="custom-scrollbar max-h-[220px] space-y-3 overflow-y-auto pr-2 pb-2">
                  {Object.keys(categoryFormSchedules)
                    .map(Number)
                    .sort((a, b) => a - b)
                    .map((dayIdx) => (
                      <div
                        key={dayIdx}
                        class="animate-fade-in flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
                      >
                        <div class="mr-1 w-10 border-r border-slate-200 pr-2 text-xs font-black tracking-widest text-slate-400 uppercase">
                          {
                            ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][
                              dayIdx
                            ]
                          }
                        </div>
                        <div class="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                          <div>
                            <label class="mb-1 block text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                              Cancha
                            </label>
                            <select
                              value={
                                categoryFormSchedules[dayIdx].pitchId || ""
                              }
                              onInput$={(ev) =>
                                (categoryFormSchedules[dayIdx].pitchId = (
                                  ev.target as HTMLSelectElement
                                ).value)
                              }
                              class="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold focus:border-emerald-500 focus:outline-none"
                            >
                              <option value="">Seleccionar...</option>
                              {studentsData.value.pitches.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label class="mb-1 block text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                              Inicio
                            </label>
                            <select
                              value={categoryFormSchedules[dayIdx].startTime}
                              onInput$={(ev) =>
                                (categoryFormSchedules[dayIdx].startTime = (
                                  ev.target as HTMLSelectElement
                                ).value)
                              }
                              class="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold focus:border-emerald-500 focus:outline-none"
                            >
                              <option value="">--:--</option>
                              {adminTimeOptions.value.map((time) => (
                                <option
                                  key={`start-${dayIdx}-${time}`}
                                  value={time}
                                >{`${time} hs`}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label class="mb-1 block text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                              Fin
                            </label>
                            <select
                              value={categoryFormSchedules[dayIdx].endTime}
                              onInput$={(ev) =>
                                (categoryFormSchedules[dayIdx].endTime = (
                                  ev.target as HTMLSelectElement
                                ).value)
                              }
                              class="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold focus:border-emerald-500 focus:outline-none"
                            >
                              <option value="">--:--</option>
                              {adminTimeOptions.value.map((time) => (
                                <option
                                  key={`end-${dayIdx}-${time}`}
                                  value={time}
                                >{`${time} hs`}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  {Object.keys(categoryFormSchedules).length === 0 && (
                    <div class="rounded-2xl border-2 border-dashed border-slate-100 py-6 text-center">
                      <p class="text-[10px] font-black tracking-widest text-slate-300 uppercase">
                        Selecciona días para definir horarios
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div class="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  onClick$={() => (isCategoryModalOpen.value = false)}
                  look="ghost"
                  class="rounded-xl px-4 py-2 font-bold text-slate-500 hover:bg-slate-100"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  look="primary"
                  class="rounded-xl bg-emerald-500 px-6 py-2 font-bold text-white shadow-sm shadow-emerald-200 hover:bg-emerald-600"
                >
                  {editingCategoryId.value
                    ? "Guardar Cambios"
                    : "Crear Categoría"}
                </Button>
              </div>
            </Form>
          </div>
        </Modal.Panel>
      </Modal.Root>

      {/* Modal para Inscribir Alumno */}
      <Modal.Root bind:show={isStudentModalOpen}>
        <Modal.Panel class="relative mx-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
          <div class="p-6">
            <div class="mb-6 flex items-center justify-between">
              <h3 class="text-xl font-black text-slate-800">
                Inscribir Alumno
              </h3>
              <button
                onClick$={() => (isStudentModalOpen.value = false)}
                class="p-2 text-slate-400 transition-colors hover:text-slate-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {createStudentAction.value?.message &&
              !createStudentAction.value.success && (
                <div class="animate-shake mb-4 rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600">
                  ⚠️ {createStudentAction.value.message}
                </div>
              )}

            <Form
              action={createStudentAction}
              class="space-y-4"
              onSubmitCompleted$={() => {
                if (createStudentAction.value?.success)
                  isStudentModalOpen.value = false;
              }}
            >
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div class="col-span-full">
                  <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Fecha de Nacimiento
                  </label>
                  <input
                    type="date"
                    name="birthDate"
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <select
                    name="category"
                    required
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">Seleccionar categoría *</option>
                    {studentsData.value.categories.map((c: any) => (
                      <option
                        key={c.id}
                        value={c.name}
                      >{`${c.name} ($${c.monthlyFee?.toLocaleString()})`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Medio de Pago *
                  </label>
                  <select
                    name="paymentMethod"
                    required
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    {studentsData.value.paymentMethods
                      .filter((pm) => pm.isActive)
                      .map((pm: any) => (
                        <option key={pm.id} value={pm.id}>
                          {pm.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div class="mt-2 border-t border-slate-100 pt-4">
                <h3 class="mb-3 text-xs font-black tracking-wider text-slate-800 uppercase">
                  Datos del Tutor
                </h3>
                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label class="mb-1 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      Nombre del Tutor
                    </label>
                    <input
                      type="text"
                      name="guardianName"
                      class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label class="mb-1 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      Teléfono
                    </label>
                    <input
                      type="text"
                      name="guardianPhone"
                      class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div class="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-6">
                <Button
                  type="button"
                  onClick$={() => (isStudentModalOpen.value = false)}
                  look="ghost"
                  class="rounded-xl px-4 py-2 font-bold text-slate-500 hover:bg-slate-100"
                >
                  Cancelar
                </Button>
                <Button
                  look="primary"
                  type="submit"
                  disabled={createStudentAction.isRunning}
                  class="rounded-xl bg-emerald-500 px-6 py-2.5 font-bold text-white hover:bg-emerald-600"
                >
                  {createStudentAction.isRunning
                    ? "Inscribiendo..."
                    : "Inscribir Alumno"}
                </Button>
              </div>
            </Form>
          </div>
        </Modal.Panel>
      </Modal.Root>

      {/* Modal Reporte Mensual */}
      <Modal.Root bind:show={isMonthlyReportModalOpen}>
        <Modal.Panel class="relative mx-auto w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl">
          <div class="p-8">
            <div class="no-print mb-6 flex items-center justify-between">
              <h3 class="text-xl font-black text-slate-800">
                Generar Reporte Mensual
              </h3>
              <div class="flex items-center gap-3">
                <select
                  value={reportCategory.value || ""}
                  onInput$={(e) =>
                    (reportCategory.value =
                      (e.target as HTMLSelectElement).value || null)
                  }
                  class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold"
                >
                  <option value="">Todas las Categorías</option>
                  {studentsData.value.categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={reportMonth.value}
                  onInput$={(e) =>
                    (reportMonth.value = Number(
                      (e.target as HTMLSelectElement).value,
                    ))
                  }
                  class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold"
                >
                  {[
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
                  ].map((m, i) => (
                    <option
                      key={i + 1}
                      value={i + 1}
                      selected={reportMonth.value === i + 1}
                    >
                      {m}
                    </option>
                  ))}
                </select>
                <button
                  onClick$={() => (isMonthlyReportModalOpen.value = false)}
                  class="p-2 text-slate-400 hover:text-slate-600"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            <div class="print-area overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div class="flex items-center justify-between bg-slate-900 p-6 text-white">
                <div>
                  <h1 class="text-2xl font-black tracking-tight uppercase">
                    Planilla de Escuelita
                  </h1>
                  <p class="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
                    {reportCategory.value
                      ? `Categoría: ${reportCategory.value}`
                      : "Todas las Categorías"}{" "}
                    -{" "}
                    {
                      [
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
                      ][reportMonth.value - 1]
                    }{" "}
                    {reportYear.value}
                  </p>
                </div>
                <div class="text-right">
                  <div class="text-xl font-black">GardenClubFutbol</div>
                  <div class="mt-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                    Control de Asistencia y Cobros
                  </div>
                </div>
              </div>

              <div class="p-0">
                <table class="w-full border-collapse text-left">
                  <thead>
                    <tr class="border-b border-slate-200 bg-slate-100">
                      <th class="border-r px-4 py-3 text-[10px] font-black tracking-widest text-slate-500 uppercase">
                        Alumno
                      </th>
                      <th class="border-r px-4 py-3 text-center text-[10px] font-black tracking-widest text-slate-500 uppercase">
                        Estado Pago
                      </th>
                      <th
                        colSpan={4}
                        class="px-4 py-3 text-center text-[10px] font-black tracking-widest text-slate-500 uppercase"
                      >
                        Asistencia (Clase 1 a 4)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsData.value.students
                      .filter(
                        (s) =>
                          !reportCategory.value ||
                          s.category === reportCategory.value,
                      )
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((s) => (
                        <tr key={s.id} class="h-12 border-b border-slate-100">
                          <td class="border-r px-4 py-2">
                            <div class="text-sm font-black text-slate-800">
                              {s.name}
                            </div>
                            <div class="text-[9px] font-bold text-slate-400 uppercase">
                              {s.category}
                            </div>
                          </td>
                          <td class="border-r px-4 py-2 text-center">
                            <div class="mx-auto flex h-6 w-24 items-center justify-center rounded border border-slate-200 text-[10px] font-bold">
                              {s.subscriptions?.[0]?.month ===
                                reportMonth.value &&
                              s.subscriptions?.[0]?.status === "PAID"
                                ? "PAGADO"
                                : ""}
                            </div>
                          </td>
                          <td class="w-12 border-r"></td>
                          <td class="w-12 border-r"></td>
                          <td class="w-12 border-r"></td>
                          <td class="w-12"></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="no-print mt-8 flex justify-end gap-3">
              <Button
                type="button"
                onClick$={() => (isMonthlyReportModalOpen.value = false)}
                look="ghost"
                class="font-bold text-slate-500"
              >
                Cancelar
              </Button>
              <Button
                onClick$={() => {
                  window.print();
                }}
                class="flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-3 font-black text-white shadow-lg transition-all hover:bg-emerald-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
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
                Imprimir Reporte
              </Button>
            </div>
          </div>
        </Modal.Panel>
      </Modal.Root>

      {/* Modal para Imprimir Cronograma */}
      <Modal.Root bind:show={isPrintModalOpen}>
        <Modal.Panel class="relative mx-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
          <div class="p-6">
            <h3 class="mb-4 flex items-center gap-2 text-xl font-black text-slate-800">
              Imprimir Cronograma del Día
            </h3>

            <div class="mb-6">
              <label class="mb-2 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                Selecciona el Día
              </label>
              <div class="grid grid-cols-7 gap-1">
                {["D", "L", "M", "M", "J", "V", "S"].map((day, idx) => (
                  <button
                    key={idx}
                    onClick$={() => (printableDay.value = idx)}
                    class={cn(
                      "h-10 rounded-lg text-xs font-black transition-all",
                      printableDay.value === idx
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
                        : "bg-slate-100 text-slate-400 hover:bg-slate-200",
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div class="custom-scrollbar print-area mb-6 max-h-[300px] overflow-y-auto rounded-xl border bg-slate-50 p-4">
              <div class="mb-4 border-b pb-2 text-center">
                <h4 class="text-lg font-black tracking-tight text-slate-800 uppercase">
                  Cronograma:{" "}
                  {
                    [
                      "Domingo",
                      "Lunes",
                      "Martes",
                      "Miércoles",
                      "Jueves",
                      "Viernes",
                      "Sábado",
                    ][printableDay.value]
                  }
                </h4>
                <p class="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                  SportGarden Futbol - Escuelita
                </p>
              </div>

              <div class="space-y-3">
                {studentsData.value.categories
                  .filter((cat: any) => {
                    const schedules =
                      cat.schedules ||
                      (cat.days
                        ? cat.days.map((d: number) => ({
                            day: d,
                            startTime: cat.startTime,
                            endTime: cat.endTime,
                          }))
                        : []);
                    return schedules.some(
                      (s: any) => s.day === printableDay.value,
                    );
                  })
                  .map((cat: any) => {
                    const sched = (
                      cat.schedules ||
                      (cat.days
                        ? cat.days.map((d: number) => ({
                            day: d,
                            startTime: cat.startTime,
                            endTime: cat.endTime,
                          }))
                        : [])
                    ).find((s: any) => s.day === printableDay.value);
                    return {
                      ...cat,
                      startTime: sched?.startTime,
                      endTime: sched?.endTime,
                    };
                  })
                  .sort((a, b) =>
                    (a.startTime || "").localeCompare(b.startTime || ""),
                  )
                  .map((cat: any) => (
                    <div
                      key={cat.id}
                      class="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                    >
                      <div class="flex items-center gap-3">
                        <div class="rounded bg-emerald-500 px-2 py-1 text-[10px] font-black text-white shadow-sm">
                          {cat.startTime} - {cat.endTime}
                        </div>
                        <div>
                          <div class="text-sm font-black text-slate-800">
                            {cat.name}
                          </div>
                          <div class="text-[10px] font-bold text-slate-500 uppercase">
                            Prof: {cat.teacher}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                {studentsData.value.categories.filter((cat: any) => {
                  const schedules =
                    cat.schedules ||
                    (cat.days
                      ? cat.days.map((d: number) => ({
                          day: d,
                          startTime: cat.startTime,
                          endTime: cat.endTime,
                        }))
                      : []);
                  return schedules.some(
                    (s: any) => s.day === printableDay.value,
                  );
                }).length === 0 && (
                  <div class="py-8 text-center text-sm font-bold text-slate-400 italic">
                    No hay clases programadas para este día.
                  </div>
                )}
              </div>
            </div>

            <div class="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <Button
                type="button"
                onClick$={() => (isPrintModalOpen.value = false)}
                look="ghost"
                class="rounded-xl px-4 py-2 font-bold text-slate-500 hover:bg-slate-100"
              >
                Cancelar
              </Button>
              <Button
                onClick$={() => {
                  window.print();
                  isPrintModalOpen.value = false;
                }}
                class="rounded-xl bg-slate-800 px-6 py-2 font-bold text-white shadow-lg hover:bg-slate-900"
              >
                Imprimir Ahora
              </Button>
            </div>
          </div>
        </Modal.Panel>
      </Modal.Root>
    </div>
  );
});

export const head = {
  title: "Escuelita - GardenClubFutbol",
};
