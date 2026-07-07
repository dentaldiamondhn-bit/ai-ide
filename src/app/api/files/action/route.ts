import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { action, targetPath, content, newName } = await request.json();

    if (!targetPath) return NextResponse.json({ error: 'Path is required' }, { status: 400 });

    switch (action) {
      case 'SAVE_FILE':
        await fs.writeFile(targetPath, content, 'utf-8');
        return NextResponse.json({ success: true, message: 'File saved successfully' });

      case 'CREATE_FILE':
        await fs.writeFile(targetPath, '', 'utf-8');
        return NextResponse.json({ success: true });

      case 'CREATE_FOLDER':
        await fs.mkdir(targetPath, { recursive: true });
        return NextResponse.json({ success: true });

      case 'RENAME':
        const dir = path.dirname(targetPath);
        const destination = path.join(dir, newName);
        await fs.rename(targetPath, destination);
        return NextResponse.json({ success: true });

      case 'DELETE':
        await fs.rm(targetPath, { recursive: true, force: true });
        return NextResponse.json({ success: true });

      case 'DUPLICATE': {
        const stat = await fs.stat(targetPath);
        const parentDir = path.dirname(targetPath);
        const ext = path.extname(targetPath);
        const base = path.basename(targetPath, ext);
        let dupPath = path.join(parentDir, `${base}-copy${ext}`);
        let counter = 1;
        while (await fs.stat(dupPath).then(() => true).catch(() => false)) {
          counter++;
          dupPath = path.join(parentDir, `${base}-copy${counter}${ext}`);
        }
        if (stat.isDirectory()) {
          await fs.cp(targetPath, dupPath, { recursive: true });
        } else {
          await fs.copyFile(targetPath, dupPath);
        }
        return NextResponse.json({ success: true, newPath: dupPath });
      }

      default:
        return NextResponse.json({ error: 'Invalid action type' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
