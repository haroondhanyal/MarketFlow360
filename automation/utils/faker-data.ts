import { faker } from "@faker-js/faker";

export function fakeLead(overrides: Partial<{ name: string; email: string; phone: string; interest: string; source: string }> = {}) {
  return {
    name: faker.person.fullName(),
    email: faker.internet.email({ provider: "example.test" }).toLowerCase(),
    phone: `+92${faker.string.numeric(10)}`,
    interest: faker.helpers.arrayElement(["Digital Marketing", "Graphic Design", "Web Development", "UI/UX Design"]),
    source: faker.helpers.arrayElement(["WEBSITE", "FACEBOOK", "INSTAGRAM", "REFERRAL", "GOOGLE"]),
    ...overrides,
  };
}

export function fakeCustomer() {
  return { name: faker.person.fullName(), company: faker.company.name(), email: faker.internet.email({ provider: "example.test" }).toLowerCase(), phone: `+92${faker.string.numeric(10)}` };
}

export function uniqueMarker() { return `${Date.now()}-${faker.string.alphanumeric(8).toLowerCase()}`; }
