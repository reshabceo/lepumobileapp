import sys
import os
import zipfile
import struct
import tempfile
import shutil

def check_so_alignment(so_path):
    with open(so_path, 'rb') as f:
        elf_ident = f.read(16)
        if len(elf_ident) < 16 or elf_ident[0:4] != b'\x7fELF':
            return None, "Not an ELF file"
        
        elf_class = elf_ident[4] # 1 = 32-bit, 2 = 64-bit
        elf_data = elf_ident[5]  # 1 = little-endian, 2 = big-endian
        
        if elf_class == 2: # 64-bit
            f.seek(32)
            phoff = struct.unpack('<Q', f.read(8))[0]
            f.seek(54)
            phentsize = struct.unpack('<H', f.read(2))[0]
            phnum = struct.unpack('<H', f.read(2))[0]
            
            alignments = []
            for i in range(phnum):
                f.seek(phoff + i * phentsize)
                p_type = struct.unpack('<I', f.read(4))[0]
                if p_type == 1: # PT_LOAD
                    # p_flags (4), p_offset (8), p_vaddr (8), p_paddr (8), p_filesz (8), p_memsz (8), p_align (8)
                    f.seek(phoff + i * phentsize + 48)
                    p_align = struct.unpack('<Q', f.read(8))[0]
                    alignments.append(p_align)
            return alignments, "64-bit"
            
        elif elf_class == 1: # 32-bit
            f.seek(28)
            phoff = struct.unpack('<I', f.read(4))[0]
            f.seek(42)
            phentsize = struct.unpack('<H', f.read(2))[0]
            phnum = struct.unpack('<H', f.read(2))[0]
            
            alignments = []
            for i in range(phnum):
                f.seek(phoff + i * phentsize)
                p_type = struct.unpack('<I', f.read(4))[0]
                if p_type == 1: # PT_LOAD
                    # p_offset (4), p_vaddr (4), p_paddr (4), p_filesz (4), p_memsz (4), p_flags (4), p_align (4)
                    f.seek(phoff + i * phentsize + 28)
                    p_align = struct.unpack('<I', f.read(4))[0]
                    alignments.append(p_align)
            return alignments, "32-bit"
            
        else:
            return None, f"Unknown ELF class {elf_class}"

def check_aar_alignment(aar_path):
    print(f"--- Checking AAR: {os.path.basename(aar_path)} ---")
    if not os.path.exists(aar_path):
        print("File does not exist")
        return
        
    temp_dir = tempfile.mkdtemp()
    try:
        with zipfile.ZipFile(aar_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
            
        so_files = []
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                if file.endswith('.so'):
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, temp_dir)
                    so_files.append((full_path, rel_path))
                    
        if not so_files:
            print("No .so files found in AAR")
            return
            
        all_16k = True
        for full_path, rel_path in so_files:
            alignments, elf_info = check_so_alignment(full_path)
            if alignments is None:
                print(f"  {rel_path}: Failed to parse ({elf_info})")
                continue
                
            is_16k = all(align >= 16384 for align in alignments) if alignments else True
            if not is_16k:
                all_16k = False
            align_str = ", ".join(str(a) for a in alignments)
            status = "✅ 16 KB Aligned" if is_16k else "❌ 4 KB Aligned (or other)"
            print(f"  {rel_path} ({elf_info}): {status} [PT_LOAD alignments: {align_str}]")
            
        if all_16k:
            print("RESULT: AAR is fully 16 KB page-aligned!")
        else:
            print("RESULT: AAR contains 4 KB aligned libraries (incompatible with Android 15's 16 KB page sizes)")
    finally:
        shutil.rmtree(temp_dir)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 check_elf_alignment.py <aar_file_or_directory>")
        sys.exit(1)
        
    target = sys.argv[1]
    if os.path.isdir(target):
        for root, dirs, files in os.walk(target):
            for file in files:
                if file.endswith('.aar'):
                    check_aar_alignment(os.path.join(root, file))
                    print()
    else:
        check_aar_alignment(target)
