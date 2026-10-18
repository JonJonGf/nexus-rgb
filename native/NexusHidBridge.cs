using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32;
using Microsoft.Win32.SafeHandles;

namespace NexusRGB.Native {
    public class NexusHidBridge {
        [StructLayout(LayoutKind.Sequential)]
        public struct HIDP_CAPS {
            public ushort Usage;
            public ushort UsagePage;
            public ushort InputReportByteLength;
            public ushort OutputReportByteLength;
            public ushort FeatureReportByteLength;
            [MarshalAs(UnmanagedType.ByValArray, SizeConst = 17)]
            public ushort[] Reserved;
            public ushort NumberLinkCollectionNodes;
            public ushort NumberInputButtonCaps;
            public ushort NumberInputValueCaps;
            public ushort NumberInputDataIndices;
            public ushort NumberOutputButtonCaps;
            public ushort NumberOutputValueCaps;
            public ushort NumberOutputDataIndices;
            public ushort NumberFeatureButtonCaps;
            public ushort NumberFeatureValueCaps;
            public ushort NumberFeatureDataIndices;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct HIDD_ATTRIBUTES {
            public int Size;
            public ushort VendorID;
            public ushort ProductID;
            public ushort VersionNumber;
        }

        [DllImport("hid.dll", SetLastError = true)]
        public static extern bool HidD_GetPreparsedData(SafeFileHandle hObject, ref IntPtr PreparsedData);

        [DllImport("hid.dll", SetLastError = true)]
        public static extern bool HidD_FreePreparsedData(IntPtr PreparsedData);

        [DllImport("hid.dll", SetLastError = true)]
        public static extern int HidP_GetCaps(IntPtr PreparsedData, ref HIDP_CAPS Capabilities);

        [DllImport("hid.dll", SetLastError = true)]
        public static extern bool HidD_GetAttributes(SafeFileHandle hObject, ref HIDD_ATTRIBUTES Attributes);

        [DllImport("hid.dll", SetLastError = true, CharSet = CharSet.Auto)]
        public static extern bool HidD_GetProductString(SafeFileHandle hObject, byte[] Buffer, int BufferLength);

        [DllImport("hid.dll", SetLastError = true)]
        public static extern bool HidD_SetFeature(SafeFileHandle hObject, byte[] lpReportBuffer, int ReportBufferLength);

        [DllImport("hid.dll", SetLastError = true)]
        public static extern bool HidD_GetFeature(SafeFileHandle hObject, byte[] lpReportBuffer, int ReportBufferLength);

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        public static extern SafeFileHandle CreateFile(
            string lpFileName,
            uint dwDesiredAccess,
            uint dwShareMode,
            IntPtr lpSecurityAttributes,
            uint dwCreationDisposition,
            uint dwFlagsAndAttributes,
            IntPtr hTemplateFile
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern bool WriteFile(
            SafeFileHandle hFile,
            byte[] lpBuffer,
            int nNumberOfBytesToWrite,
            out int lpNumberOfBytesWritten,
            IntPtr lpOverlapped
        );

        private static Dictionary<string, SafeFileHandle> _openHandles = new Dictionary<string, SafeFileHandle>(StringComparer.OrdinalIgnoreCase);

        private static SafeFileHandle GetOrCreateHandle(string path, bool writeAccess) {
            SafeFileHandle handle;
            if (_openHandles.TryGetValue(path, out handle) && !handle.IsInvalid && !handle.IsClosed) {
                return handle;
            }
            uint access = writeAccess ? 0xC0000000 : 0; // GENERIC_READ | GENERIC_WRITE
            handle = CreateFile(path, access, 3, IntPtr.Zero, 3, 0, IntPtr.Zero);
            if (!handle.IsInvalid && writeAccess) {
                _openHandles[path] = handle;
            }
            return handle;
        }

        public static byte[] HexToBytes(string hex) {
            if (string.IsNullOrEmpty(hex)) return new byte[0];
            int len = hex.Length;
            byte[] bytes = new byte[len / 2];
            for (int i = 0; i < len; i += 2) {
                bytes[i / 2] = Convert.ToByte(hex.Substring(i, 2), 16);
            }
            return bytes;
        }

        public static void EnumerateDevices() {
            var results = new List<string>();
            const string hidGuid = "{4d1e55b2-f16f-11cf-88cb-001111000030}";
            using (var key = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\DeviceClasses\" + hidGuid)) {
                if (key != null) {
                    foreach (var subKeyName in key.GetSubKeyNames()) {
                        string path = subKeyName.Replace("##?#", @"\\?\");
                        SafeFileHandle handle = CreateFile(path, 0, 3, IntPtr.Zero, 3, 0, IntPtr.Zero);
                        if (handle.IsInvalid) continue;

                        HIDD_ATTRIBUTES attr = new HIDD_ATTRIBUTES();
                        attr.Size = Marshal.SizeOf(attr);
                        ushort vid = 0, pid = 0;
                        if (HidD_GetAttributes(handle, ref attr)) {
                            vid = attr.VendorID;
                            pid = attr.ProductID;
                        }

                        ushort usagePage = 0, usage = 0, featLen = 0, outLen = 0;
                        IntPtr preparsed = IntPtr.Zero;
                        if (HidD_GetPreparsedData(handle, ref preparsed)) {
                            HIDP_CAPS caps = new HIDP_CAPS();
                            HidP_GetCaps(preparsed, ref caps);
                            usagePage = caps.UsagePage;
                            usage = caps.Usage;
                            featLen = caps.FeatureReportByteLength;
                            outLen = caps.OutputReportByteLength;
                            HidD_FreePreparsedData(preparsed);
                        }
                        handle.Close();

                        if (vid != 0) {
                            string escapedPath = path.Replace(@"\", @"\\");
                            results.Add(string.Format("{{\"path\":\"{0}\",\"vid\":\"0x{1:X4}\",\"pid\":\"0x{2:X4}\",\"usagePage\":{3},\"usage\":{4},\"featLen\":{5},\"outLen\":{6}}}",
                                escapedPath, vid, pid, usagePage, usage, featLen, outLen));
                        }
                    }
                }
            }
            Console.WriteLine("[" + string.Join(",", results.ToArray()) + "]");
        }

        public static void Main(string[] args) {
            Console.OutputEncoding = Encoding.UTF8;
            if (args.Length > 0 && args[0] == "--enumerate") {
                EnumerateDevices();
                return;
            }

            Console.WriteLine("{\"status\":\"ready\",\"version\":\"1.0\"}");

            string line;
            while ((line = Console.ReadLine()) != null) {
                line = line.Trim();
                if (string.IsNullOrEmpty(line)) continue;
                if (line == "exit" || line == "quit") break;

                try {
                    if (line.Contains("\"enumerate\"")) {
                        EnumerateDevices();
                    } else if (line.Contains("\"set_feature\"")) {
                        string path = ExtractJsonField(line, "path");
                        string hex = ExtractJsonField(line, "hex");
                        byte[] data = HexToBytes(hex);
                        SafeFileHandle handle = GetOrCreateHandle(path, true);
                        if (handle.IsInvalid) {
                            Console.WriteLine("{\"status\":\"error\",\"message\":\"open_failed\",\"code\":" + Marshal.GetLastWin32Error() + "}");
                        } else {
                            bool ok = HidD_SetFeature(handle, data, data.Length);
                            if (ok) {
                                Console.WriteLine("{\"status\":\"ok\"}");
                            } else {
                                int err = Marshal.GetLastWin32Error();
                                // Remove cached handle on error
                                _openHandles.Remove(path);
                                handle.Close();
                                Console.WriteLine("{\"status\":\"error\",\"message\":\"set_feature_failed\",\"code\":" + err + "}");
                            }
                        }
                    } else if (line.Contains("\"get_feature\"")) {
                        string path = ExtractJsonField(line, "path");
                        string hex = ExtractJsonField(line, "hex");
                        int length = 65;
                        string lenStr = ExtractJsonField(line, "length");
                        if (!string.IsNullOrEmpty(lenStr)) int.TryParse(lenStr, out length);
                        byte[] data = new byte[length];
                        if (!string.IsNullOrEmpty(hex)) {
                            byte[] init = HexToBytes(hex);
                            Array.Copy(init, data, Math.Min(init.Length, data.Length));
                        }
                        SafeFileHandle handle = GetOrCreateHandle(path, true);
                        if (handle.IsInvalid) {
                            Console.WriteLine("{\"status\":\"error\",\"message\":\"open_failed\",\"code\":" + Marshal.GetLastWin32Error() + "}");
                        } else {
                            bool ok = HidD_GetFeature(handle, data, data.Length);
                            if (ok) {
                                Console.WriteLine("{\"status\":\"ok\",\"hex\":\"" + BitConverter.ToString(data).Replace("-", "") + "\"}");
                            } else {
                                int err = Marshal.GetLastWin32Error();
                                _openHandles.Remove(path);
                                handle.Close();
                                Console.WriteLine("{\"status\":\"error\",\"message\":\"get_feature_failed\",\"code\":" + err + "}");
                            }
                        }
                    } else if (line.Contains("\"write\"")) {
                        string path = ExtractJsonField(line, "path");
                        string hex = ExtractJsonField(line, "hex");
                        byte[] data = HexToBytes(hex);
                        SafeFileHandle handle = GetOrCreateHandle(path, true);
                        if (handle.IsInvalid) {
                            Console.WriteLine("{\"status\":\"error\",\"message\":\"open_failed\",\"code\":" + Marshal.GetLastWin32Error() + "}");
                        } else {
                            int written;
                            bool ok = WriteFile(handle, data, data.Length, out written, IntPtr.Zero);
                            if (ok) {
                                Console.WriteLine("{\"status\":\"ok\",\"written\":" + written + "}");
                            } else {
                                int err = Marshal.GetLastWin32Error();
                                _openHandles.Remove(path);
                                handle.Close();
                                Console.WriteLine("{\"status\":\"error\",\"message\":\"write_failed\",\"code\":" + err + "}");
                            }
                        }
                    } else if (line.Contains("\"ping\"")) {
                        Console.WriteLine("{\"status\":\"pong\"}");
                    } else {
                        Console.WriteLine("{\"status\":\"error\",\"message\":\"unknown_action\"}");
                    }
                } catch (Exception ex) {
                    Console.WriteLine("{\"status\":\"error\",\"message\":\"" + ex.Message.Replace("\"", "'") + "\"}");
                }
            }

            foreach (var h in _openHandles.Values) {
                try { if (!h.IsClosed) h.Close(); } catch { }
            }
        }

        private static string ExtractJsonField(string json, string field) {
            string pattern = "\"" + field + "\":\"";
            int idx = json.IndexOf(pattern);
            if (idx < 0) return "";
            int start = idx + pattern.Length;
            int end = json.IndexOf("\"", start);
            if (end < 0) return "";
            return json.Substring(start, end - start).Replace(@"\\", @"\");
        }
    }
}
