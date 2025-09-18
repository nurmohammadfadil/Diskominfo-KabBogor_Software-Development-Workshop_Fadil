"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Phone number formatting function
const formatPhoneNumber = (phone) => {
  if (!phone) return "";

  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");

  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, "");

  // If it starts with 62, it's already in international format
  if (cleaned.startsWith("62")) {
    return `+${cleaned}`;
  }

  // For Indonesian mobile numbers, add 62
  if (cleaned.length >= 8 && cleaned.length <= 13) {
    return `+62${cleaned}`;
  }

  // Default: assume it's a mobile number and add 62
  return `+62${cleaned}`;
};

export default function NewSubmission() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    nama: "",
    nik: "",
    email: "",
    no_wa: "",
    jenis_layanan: "",
    consent: false,
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.nama.trim()) {
      newErrors.nama = "Nama wajib diisi";
    }

    if (!formData.nik.trim()) {
      newErrors.nik = "Nomor KTP harus 16 digit";
    } else if (!/^\d{16}$/.test(formData.nik)) {
      newErrors.nik = "Nomor KTP harus 16 digit";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email wajib diisi";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Format email tidak valid";
    }

    if (!formData.no_wa.trim()) {
      newErrors.no_wa = "Nomor WhatsApp wajib diisi";
    } else if (!/^\d+$/.test(formData.no_wa.replace(/\s+/g, ""))) {
      newErrors.no_wa = "Nomor WhatsApp harus angka saja";
    }

    if (!formData.jenis_layanan) {
      newErrors.jenis_layanan = "Jenis layanan wajib dipilih";
    }

    if (!formData.consent) {
      newErrors.consent = "Anda harus menyetujui pemberian notifikasi";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // Format phone number to +62 format before sending
      const formattedData = {
        ...formData,
        no_wa: formatPhoneNumber(formData.no_wa),
      };

      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formattedData),
      });

      const result = await response.json();

      if (response.ok) {
        // Redirect to success page with tracking code
        router.push(`/public/success?tracking_code=${result.tracking_code}`);
      } else {
        setErrors({
          submit: result.message || "Terjadi kesalahan saat mengirim pengajuan",
        });
      }
    } catch (error) {
      setErrors({ submit: "Terjadi kesalahan jaringan" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Form Pengajuan Layanan
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nama */}
        <div>
          <label
            htmlFor="nama"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Nama Lengkap *
          </label>
          <input
            type="text"
            id="nama"
            name="nama"
            value={formData.nama}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black ${
              errors.nama ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="Masukkan nama lengkap"
          />
          {errors.nama && (
            <p className="mt-1 text-sm text-red-600">{errors.nama}</p>
          )}
        </div>

        {/* NIK */}
        <div>
          <label
            htmlFor="nik"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Nomor KTP (16 digit) *
          </label>
          <input
            type="text"
            id="nik"
            name="nik"
            value={formData.nik}
            onChange={handleChange}
            maxLength={16}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black ${
              errors.nik ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="Masukkan 16 digit NIK"
          />
          {errors.nik && (
            <p className="mt-1 text-sm text-red-600">{errors.nik}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Email *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black ${
              errors.email ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="contoh@email.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        {/* WhatsApp */}
        <div>
          <label
            htmlFor="no_wa"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Nomor WhatsApp *
          </label>
          <input
            type="tel"
            id="no_wa"
            name="no_wa"
            value={formData.no_wa}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black ${
              errors.no_wa ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="08xxxxxxxxxx (akan diformat ke +62...)"
          />
          {errors.no_wa && (
            <p className="mt-1 text-sm text-red-600">{errors.no_wa}</p>
          )}
        </div>

        {/* Jenis Layanan */}
        <div>
          <label
            htmlFor="jenis_layanan"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Jenis Layanan *
          </label>
          <select
            id="jenis_layanan"
            name="jenis_layanan"
            value={formData.jenis_layanan}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black ${
              errors.jenis_layanan ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Pilih jenis layanan</option>
            <option value="KTP">Pembuatan KTP</option>
            <option value="KK">Pembuatan Kartu Keluarga</option>
            <option value="AKTA">Pembuatan Akta Kelahiran</option>
            <option value="SKCK">Pembuatan SKCK</option>
            <option value="SURAT_PINDAH">Surat Pindah</option>
            <option value="SURAT_KETERANGAN">Surat Keterangan</option>
          </select>
          {errors.jenis_layanan && (
            <p className="mt-1 text-sm text-red-600">{errors.jenis_layanan}</p>
          )}
        </div>

        {/* Consent */}
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="consent"
              name="consent"
              type="checkbox"
              checked={formData.consent}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="consent" className="text-gray-700">
              Saya setuju untuk menerima notifikasi status pengajuan melalui
              WhatsApp dan email
            </label>
            {errors.consent && (
              <p className="mt-1 text-red-600">{errors.consent}</p>
            )}
          </div>
        </div>

        {/* Submit Error */}
        {errors.submit && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600">{errors.submit}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
        >
          {isSubmitting ? "Mengirim..." : "Kirim Pengajuan"}
        </button>
      </form>
    </div>
  );
}
