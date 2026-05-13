import { getDB } from "./index";
import { 
  pitches, bookings, users, cashRegisters, cashMovements, 
  students, studentSubscriptions, studentPayments,
  groups, pitchSubscriptions,
  siteSettings
} from "./schema";
import { eq } from "drizzle-orm";

export async function seedDemoData(requestEvent: any) {
  const db = getDB(requestEvent);

  console.log("🌱 Seeding demo data...");

  // 0. Ensure site settings exist
  const existingSettings = await db.select().from(siteSettings).where(eq(siteSettings.id, 1));
  if (existingSettings.length === 0) {
    console.log("Creating default site settings...");
    await db.insert(siteSettings).values({
      id: 1,
      clubName: "GardenClubFutbol",
      clubAddress: "Calle Falsa 123",
      clubPhone: "1122334455",
      bankAlias: "gardenclub.alias",
      operatingHours: [
        { day: 0, isOpen: true, openTime: "08:00", closeTime: "23:00" },
        { day: 1, isOpen: true, openTime: "08:00", closeTime: "23:00" },
        { day: 2, isOpen: true, openTime: "08:00", closeTime: "23:00" },
        { day: 3, isOpen: true, openTime: "08:00", closeTime: "23:00" },
        { day: 4, isOpen: true, openTime: "08:00", closeTime: "23:00" },
        { day: 5, isOpen: true, openTime: "08:00", closeTime: "23:00" },
        { day: 6, isOpen: true, openTime: "08:00", closeTime: "23:00" },
        { day: 7, isOpen: true, openTime: "08:00", closeTime: "23:00" },
      ],
      services: ["Wi-Fi", "Vestuarios", "Estacionamiento"],
      paymentMethods: [
        { id: "CASH", name: "Efectivo", isActive: true },
        { id: "TRANSFER", name: "Transferencia", isActive: true },
        { id: "MERCADO_PAGO", name: "Mercado Pago", isActive: true },
        { id: "CURRENT_ACCOUNT", name: "Cuenta Corriente", isActive: true },
      ],
      movementCategories: [
        { id: "BOOKING", name: "Reservas", type: "INCOME", icon: "⚽" },
        { id: "SCHOOL", name: "Escuelita", type: "INCOME", icon: "🏫" },
        { id: "KIOSK", name: "Ventas Kiosco", type: "INCOME", icon: "🍿" },
        { id: "EXTRAS", name: "Alquileres Extra", type: "INCOME", icon: "🎟️" },
        { id: "OTHER_INCOME", name: "Otros Ingresos", type: "INCOME", icon: "📌" },
        { id: "MAINTENANCE", name: "Mantenimiento", type: "EXPENSE", icon: "🔧" },
        { id: "SALARY", name: "Sueldos", type: "EXPENSE", icon: "💼" },
        { id: "SERVICES", name: "Servicios", type: "EXPENSE", icon: "💡" },
        { id: "OTHER_EXPENSE", name: "Otros Gastos", type: "EXPENSE", icon: "📌" },
      ]
    });
  }

  // 1. Ensure we have some pitches
  const existingPitches = await db.select().from(pitches).limit(5);
  if (existingPitches.length === 0) {
    console.log("No pitches found, creating some...");
    await db.insert(pitches).values([
      { id: "p1", name: "Cancha 1", type: "F5", pricePerHour: 8000, isActive: true, sport: "Fútbol", surface: "Sintético" },
      { id: "p2", name: "Cancha 2", type: "F5", pricePerHour: 8000, isActive: true, sport: "Fútbol", surface: "Sintético" },
      { id: "p3", name: "Estadio F7", type: "F7", pricePerHour: 12000, isActive: true, sport: "Fútbol", surface: "Sintético" },
    ]);
  }
  const allPitches = await db.select().from(pitches);

  // 2. Ensure we have an admin user
  const adminUser = await db.query.users.findFirst({ where: eq(users.role, "OWNER") });
  const adminId = adminUser?.id || "admin-seed";
  if (!adminUser) {
    await db.insert(users).values({
      id: adminId,
      name: "Admin Seed",
      email: "admin@gardenclubfutbol.com",
      role: "OWNER"
    });
  }

  // 3. Create Groups (Cuentas Corrientes)
  console.log("Creating groups...");
  await db.insert(groups).values([
    { id: "g1", name: "Los Amigos FC", contactName: "Juan Pérez", contactPhone: "1122334455", balance: -5000 },
    { id: "g2", name: "Empresa Tech", contactName: "Marta Gómez", contactPhone: "1166778899", balance: 10000 },
    { id: "g3", name: "Veteranos", contactName: "Carlos Ruiz", contactPhone: "1199887766", balance: 0 },
  ]).onConflictDoNothing();

  // 4. Create Students (Escuelita)
  console.log("Creating students...");
  const studentIds = ["s1", "s2", "s3", "s4"];
  await db.insert(students).values([
    { id: "s1", name: "Mateo Messi", category: "2015/2016", monthlyFee: 15000, guardianName: "Lionel", guardianPhone: "123456" },
    { id: "s2", name: "Thiago Scaloni", category: "2015/2016", monthlyFee: 15000, guardianName: "Lionel S", guardianPhone: "654321" },
    { id: "s3", name: "Bauti Di Maria", category: "2013/2014", monthlyFee: 15000, guardianName: "Angel", guardianPhone: "111222" },
    { id: "s4", name: "Cuti Romero Jr", category: "2013/2014", monthlyFee: 15000, guardianName: "Cristian", guardianPhone: "333444" },
  ]).onConflictDoNothing();

  // 5. Generate data for the last 7 days
  console.log("Generating history for last 7 days...");
  const now = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    day.setHours(9, 0, 0, 0); // Open at 9 AM
    
    const registerId = `reg-${day.toISOString().split('T')[0]}`;
    
    // Open Register
    await db.insert(cashRegisters).values({
      id: registerId,
      openedAt: new Date(day),
      openingBalance: 5000,
      status: "CLOSED",
      openedBy: adminId,
      closedBy: adminId,
      closedAt: new Date(day.getTime() + 14 * 60 * 60 * 1000), // Close after 14 hours
      closingBalance: 0, // Will calculate later maybe, but let's put something
    }).onConflictDoNothing();

    // Create some Bookings and Movements for this day
    const dayBookings = [
      { h: 18, p: allPitches[0].id, guest: "Seba", paid: 8000 },
      { h: 19, p: allPitches[1].id, guest: "Facu", paid: 4000 }, // Partial
      { h: 20, p: allPitches[2].id, guest: "Nico", paid: 12000 },
    ];

    let totalIncome = 0;

    for (const b of dayBookings) {
      const bId = `book-${registerId}-${b.h}`;
      const startTime = new Date(day);
      startTime.setHours(b.h, 0, 0, 0);
      const endTime = new Date(day);
      endTime.setHours(b.h + 1, 0, 0, 0);

      await db.insert(bookings).values({
        id: bId,
        pitchId: b.p,
        startTime,
        endTime,
        status: "COMPLETED",
        totalPrice: b.paid === 4000 ? 8000 : b.paid,
        paidAmount: b.paid,
        paymentStatus: b.paid >= 8000 ? "PAID" : "PARTIAL",
        paymentMethod: "CASH",
      }).onConflictDoNothing();

      await db.insert(cashMovements).values({
        id: `mov-b-${bId}`,
        registerId,
        type: "INCOME",
        category: "BOOKING",
        amount: b.paid,
        description: `Cobro reserva: ${b.guest}`,
        paymentMethod: "CASH",
        referenceId: bId,
        createdAt: startTime,
      }).onConflictDoNothing();
      
      totalIncome += b.paid;
    }

    // Add a School payment some days
    if (i % 2 === 0) {
      const studentId = studentIds[i % 4];
      const subId = `sub-${studentId}-${day.getMonth()}`;
      
      await db.insert(studentSubscriptions).values({
        id: subId,
        studentId,
        month: day.getMonth() + 1,
        year: day.getFullYear(),
        price: 15000,
        status: "PAID",
      }).onConflictDoNothing();

      const payId = `pay-${subId}`;
      await db.insert(studentPayments).values({
        id: payId,
        subscriptionId: subId,
        amount: 15000,
        paymentMethod: "CASH",
        paymentDate: day,
      }).onConflictDoNothing();

      await db.insert(cashMovements).values({
        id: `mov-s-${payId}`,
        registerId,
        type: "INCOME",
        category: "SCHOOL",
        amount: 15000,
        description: `Cuota Escuelita: ${studentId}`,
        paymentMethod: "CASH",
        referenceId: payId,
        createdAt: day,
      }).onConflictDoNothing();
      
      totalIncome += 15000;
    }

    // Add an expense (Maintenance/Services)
    if (i % 3 === 0) {
      const expenseAmount = 2000 + (Math.random() * 3000);
      await db.insert(cashMovements).values({
        id: `mov-exp-${registerId}`,
        registerId,
        type: "EXPENSE",
        category: "MAINTENANCE",
        amount: Math.round(expenseAmount),
        description: "Compra artículos de limpieza / Luz",
        paymentMethod: "CASH",
        createdAt: day,
      }).onConflictDoNothing();
      
      totalIncome -= Math.round(expenseAmount);
    }

    // Update closing balance
    await db.update(cashRegisters)
      .set({ closingBalance: 5000 + totalIncome })
      .where(eq(cashRegisters.id, registerId));
  }

  // 6. Create some Fixed Subscriptions (Abonos Fijos)
  console.log("Creating fixed subscriptions...");
  await db.insert(pitchSubscriptions).values([
    { 
      id: "sub-fijo-1", 
      pitchId: allPitches[0].id, 
      dayOfWeek: 1, // Lunes
      startTime: "20:00", 
      endTime: "21:00", 
      startDate: new Date(2026, 0, 1), 
      pricePerMatch: 8000,
      isActive: true,
      groupId: "g1"
    },
  ]).onConflictDoNothing();

  console.log("✅ Demo data seeded successfully!");
}
