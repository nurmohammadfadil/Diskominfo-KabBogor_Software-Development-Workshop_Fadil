import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Admin, sequelize } from "../../../../lib/sequelize";

const { Op } = require("sequelize");

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Username dan password harus diisi" 
        },
        { status: 400 }
      );
    }

    // Find admin by username or email
    const admin = await Admin.findOne({
      where: {
        [Op.or]: [
          { username: username },
          { email: username }
        ]
      }
    });

    if (!admin) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Username atau password salah" 
        },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    
    if (!isPasswordValid) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Username atau password salah" 
        },
        { status: 401 }
      );
    }

    // Return success response (without password)
    const { password: _, ...adminWithoutPassword } = admin.toJSON();
    
    return NextResponse.json({
      success: true,
      message: "Login berhasil",
      data: {
        admin: adminWithoutPassword
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "Terjadi kesalahan server" 
      },
      { status: 500 }
    );
  }
}
