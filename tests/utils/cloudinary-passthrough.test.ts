import { describe, expect, it } from "vitest"
import { cloudinaryPresets, getCloudinaryUrl } from "@/lib/utils/cloudinary"

/**
 * EPIC #4 test imagery: local preset paths (/img/presets/...) and
 * non-Cloudinary external URLs must pass through getCloudinaryUrl
 * untouched — resize transformations only make sense for Cloudinary
 * assets. Before this rule, local paths were mangled into broken
 * `res.cloudinary.com/<cloud>/<transform>/img/...` URLs.
 */
describe("getCloudinaryUrl pass-through (local & external imagery)", () => {
  it("returns local app paths unchanged (no cloudinary mangling)", () => {
    expect(getCloudinaryUrl("/img/presets/beard.jpg", { width: 400, height: 400 })).toBe("/img/presets/beard.jpg")
    expect(getCloudinaryUrl("/api/media/abc123")).toBe("/api/media/abc123")
  })

  it("returns non-Cloudinary external URLs unchanged", () => {
    const url = "https://example.com/photo.jpg"
    expect(getCloudinaryUrl(url, { width: 200 })).toBe(url)
  })

  it("still transforms Cloudinary full URLs", () => {
    const out = getCloudinaryUrl(
      "https://res.cloudinary.com/demo/image/upload/v123/services/haircut",
      { width: 400, height: 400 }
    )
    expect(out).toContain("res.cloudinary.com/demo/image/upload/")
    expect(out).toContain("w_400,h_400")
    expect(out).toContain("v123/services/haircut")
  })

  it("bare public IDs render the local placeholder when no cloud is configured (P1 #18)", () => {
    // P1 #18: without NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME there is no owned
    // account to resolve public IDs against, so instead of building a URL
    // against a third-party account we serve the local placeholder.
    const out = getCloudinaryUrl("services_haircut_ksqpaa", { width: 400 })
    expect(out).toBe("/images/placeholders/placeholder.svg")
  })

  it("presets preserve pass-through semantics", () => {
    expect(cloudinaryPresets.serviceCard("/img/presets/laser.jpg")).toBe("/img/presets/laser.jpg")
    expect(cloudinaryPresets.staffCard("/img/presets/staff.jpg")).toBe("/img/presets/staff.jpg")
    expect(cloudinaryPresets.staffAvatar("/api/media/x1")).toBe("/api/media/x1")
  })

  it("empty value still falls back to placeholder", () => {
    expect(getCloudinaryUrl("")).toBe("/images/placeholders/placeholder.svg")
  })
})
