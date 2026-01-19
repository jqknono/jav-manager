using System.Diagnostics;
using System.Text;

var url = "https://javdb.com";
var psi = new ProcessStartInfo
{
    FileName = "curl",
    UseShellExecute = false,
    RedirectStandardOutput = true,
    RedirectStandardError = true,
    CreateNoWindow = true,
    StandardOutputEncoding = Encoding.UTF8
};

psi.ArgumentList.Add("-s");
psi.ArgumentList.Add("-L");
psi.ArgumentList.Add("-w");
psi.ArgumentList.Add("\n%{http_code}");
psi.ArgumentList.Add("--max-time");
psi.ArgumentList.Add("30");
psi.ArgumentList.Add("--compressed");
psi.ArgumentList.Add("-H");
psi.ArgumentList.Add("User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
psi.ArgumentList.Add("-H");
psi.ArgumentList.Add("Cookie: over18=1");
psi.ArgumentList.Add(url);

using var process = new Process { StartInfo = psi };
var outputBuilder = new StringBuilder();
var errorBuilder = new StringBuilder();

process.OutputDataReceived += (_, e) =>
{
    if (e.Data != null)
        outputBuilder.AppendLine(e.Data);
};
process.ErrorDataReceived += (_, e) =>
{
    if (e.Data != null)
        errorBuilder.AppendLine(e.Data);
};

process.Start();
process.BeginOutputReadLine();
process.BeginErrorReadLine();

process.WaitForExit();

var output = outputBuilder.ToString();
var error = errorBuilder.ToString();

Console.WriteLine($"Exit code: {process.ExitCode}");
Console.WriteLine($"Error: {error}");
Console.WriteLine($"Output length: {output.Length}");

var lines = output.TrimEnd().Split('\n');
Console.WriteLine($"Lines count: {lines.Length}");
Console.WriteLine($"Last line: '{lines[^1].Trim()}'");

if (lines.Length > 0 && int.TryParse(lines[^1].Trim(), out var code))
{
    Console.WriteLine($"Status code parsed: {code}");
}
else
{
    Console.WriteLine("Failed to parse status code");
    Console.WriteLine($"Last 5 lines:");
    foreach (var line in lines.TakeLast(5))
    {
        Console.WriteLine($"  '{line}'");
    }
}
