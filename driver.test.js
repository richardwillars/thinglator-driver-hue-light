const driverModule = require("./driver");

describe("driver", () => {
  it("should export a function", () => {
    expect(typeof driverModule).toEqual("function");
  });
});
