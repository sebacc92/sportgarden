import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, Link } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { students } from "~/db/schema";
import { desc } from "drizzle-orm";
import { Button } from "~/components/ui";

export const useStudentsData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  
  const allStudents = await db.query.students.findMany({
    orderBy: [desc(students.createdAt)],
  });

  return {
    students: allStudents,
  };
});

export const useCreateStudentAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    
    await db.insert(students).values({
      id: crypto.randomUUID(),
      name: data.name,
      guardianName: data.guardianName,
      guardianPhone: data.guardianPhone,
      guardianEmail: data.guardianEmail,
      category: data.category,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
    });
    
    return { success: true };
  },
  zod$({
    name: z.string().min(1),
    guardianName: z.string().optional(),
    guardianPhone: z.string().optional(),
    guardianEmail: z.string().email().optional().or(z.literal("")),
    category: z.string().optional(),
    birthDate: z.string().optional(),
  })
);

export default component$(() => {
  const studentsData = useStudentsData();
  const createStudentAction = useCreateStudentAction();

  return (
    <div class="p-6 bg-slate-50 min-h-full font-sans">
      <div class="max-w-6xl mx-auto space-y-6">
        
        <div class="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 class="text-3xl font-black tracking-tight text-slate-800">Escuelita</h1>
            <p class="text-slate-500 mt-1">Gestión de alumnos y cuotas mensuales.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Create Student Form */}
          <div class="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <h2 class="text-xl font-black text-slate-800 mb-4">Inscribir Alumno</h2>
            <Form action={createStudentAction} class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre Completo *</label>
                <input type="text" name="name" required class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha de Nacimiento</label>
                <input type="date" name="birthDate" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Categoría</label>
                <input type="text" name="category" placeholder="Ej: 2012/2013" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </div>

              <div class="border-t border-slate-100 pt-4 mt-2">
                <h3 class="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">Datos del Tutor</h3>
                <div class="space-y-3">
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

              <Button look="primary" type="submit" disabled={createStudentAction.isRunning} class="w-full py-3 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl font-bold mt-4">
                {createStudentAction.isRunning ? "Inscribiendo..." : "Inscribir Alumno"}
              </Button>
            </Form>
          </div>

          {/* Students List */}
          <div class="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div class="flex-1 overflow-auto p-0">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-slate-50/80 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                    <th class="p-4">Alumno</th>
                    <th class="p-4">Categoría</th>
                    <th class="p-4">Tutor</th>
                    <th class="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody class="text-sm font-semibold text-slate-700">
                  {studentsData.value.students.length === 0 ? (
                    <tr>
                      <td colSpan={4} class="p-8 text-center text-slate-500">
                        No hay alumnos inscriptos.
                      </td>
                    </tr>
                  ) : (
                    studentsData.value.students.map((s) => (
                      <tr key={s.id} class="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td class="p-4">
                          <div class="font-black">{s.name}</div>
                          <div class="text-xs text-slate-400">{s.birthDate ? new Date(s.birthDate).toLocaleDateString("es-AR") : "-"}</div>
                        </td>
                        <td class="p-4">
                          <span class="px-2 py-1 bg-slate-100 rounded-md text-xs font-bold text-slate-600">{s.category || "Sin asignar"}</span>
                        </td>
                        <td class="p-4 text-slate-500">
                          <div>{s.guardianName || "-"}</div>
                          <div class="text-[10px] text-slate-400">{s.guardianPhone}</div>
                        </td>
                        <td class="p-4 text-center">
                          <Link href={`/admin/school/${s.id}/`} class="text-emerald-600 hover:text-emerald-700 font-bold text-xs uppercase tracking-wider bg-emerald-50 px-3 py-1.5 rounded-lg">
                            Gestión de Cuotas
                          </Link>
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
  title: "Escuelita - SportGardenFutbol",
};
