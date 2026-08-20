import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingPage } from "./PublicPages.jsx";
describe("landing page", () => {
  it("states the product promise", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: /know where to charge/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /recommend a charger/i })).toBeInTheDocument();
  });
});
