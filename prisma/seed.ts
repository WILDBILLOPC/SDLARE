import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "op@sdlare.com";
  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "SDLARE Operator",
      role: "ADMIN",
      passwordHash,
    },
  });

  // Only seed sample records on a fresh database.
  const existingLoans = await prisma.loan.count();
  if (existingLoans === 0) {
    const property = await prisma.property.create({
      data: {
        address: "1234 Sunset Cliffs Blvd",
        city: "San Diego",
        state: "CA",
        zip: "92107",
        propertyType: "Single Family",
        status: "ACTIVE",
        listPrice: 1250000,
        beds: 4,
        baths: 3,
        sqft: 2400,
        ownerId: admin.id,
        notes: "Ocean Beach listing, strong interest.",
      },
    });

    await prisma.loan.createMany({
      data: [
        {
          borrowerName: "Maria Gonzalez",
          borrowerEmail: "maria@example.com",
          borrowerPhone: "619-555-0142",
          loanType: "Conventional",
          amount: 875000,
          interestRate: 6.5,
          stage: "UNDERWRITING",
          ownerId: admin.id,
          propertyId: property.id,
        },
        {
          borrowerName: "James Park",
          borrowerEmail: "james@example.com",
          loanType: "FHA",
          amount: 540000,
          interestRate: 6.25,
          stage: "PROCESSING",
          ownerId: admin.id,
        },
        {
          borrowerName: "The Nguyen Family",
          loanType: "VA",
          amount: 720000,
          stage: "LEAD",
          ownerId: admin.id,
        },
        {
          borrowerName: "Acme Holdings LLC",
          loanType: "Jumbo",
          amount: 2100000,
          interestRate: 6.9,
          stage: "APPROVED",
          ownerId: admin.id,
        },
      ],
    });
  }

  console.log(`Seeded. Admin login: ${email} / password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
