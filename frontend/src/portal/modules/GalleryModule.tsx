import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { GalleryImage, Paginated } from "../../types/api";

export function GalleryModule() {
  const { user } = useAuth();
  const canManage = user?.role === "SUPER_ADMIN";

  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Paginated<GalleryImage>>("/content/gallery/");
      setImages(data.results);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Could not load the gallery.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setFormError("Choose an image first.");
      return;
    }
    setFormError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("caption", caption);
      const created = await api.postForm<GalleryImage>("/content/gallery/", formData);
      setImages((prev) => [created, ...prev]);
      setFile(null);
      setCaption("");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(img: GalleryImage) {
    setBusyId(img.id);
    try {
      await api.del(`/content/gallery/${img.id}/`);
      setImages((prev) => prev.filter((i) => i.id !== img.id));
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Could not delete image.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="dash-panel">
      <h2>Gallery</h2>
      <p className="dash-panel-sub">{canManage ? "Upload and manage school photos (max 5 MB, JPEG/PNG/WebP)." : "School photo gallery."}</p>

      {canManage && (
        <form className="dash-form" onSubmit={handleUpload}>
          <div className="form-field">
            <label htmlFor="gFile">Image</label>
            <input id="gFile" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="form-field">
            <label htmlFor="gCaption">Caption (optional)</label>
            <input id="gCaption" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} />
          </div>
          {formError && <p className="alert alert-error">{formError}</p>}
          <button type="submit" className="btn btn-primary btn-sm" disabled={uploading} style={{ alignSelf: "flex-start" }}>
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </form>
      )}

      {listError && <p className="alert alert-error" style={{ marginTop: 16 }}>{listError}</p>}

      {loading ? (
        <p className="dash-loading">Loading…</p>
      ) : images.length === 0 ? (
        <p className="dash-empty">No photos yet.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginTop: 20 }}>
          {images.map((img) => (
            <div key={img.id} style={{ position: "relative" }}>
              <img
                src={img.image}
                alt={img.caption || "Gallery photo"}
                style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
              />
              {canManage && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busyId === img.id}
                  onClick={() => handleDelete(img)}
                  style={{ marginTop: 6, width: "100%" }}
                >
                  {busyId === img.id ? "Removing…" : "Remove"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
