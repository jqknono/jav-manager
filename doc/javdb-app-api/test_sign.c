#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dlfcn.h>

/*
 * libsecurity.so exports (demangled):
 *   encrypt(char*, char*, int)        — AES encrypt, produces raw bytes
 *   decrypt(char*, char*, int)        — AES decrypt
 *   AesEncrypt(unsigned char*, unsigned char*, int)
 *   Contrary_AesEncrypt(unsigned char*, unsigned char*, int)
 *   ScheduleKey(unsigned char*, unsigned char*, int, int)
 *   MD5Init(MD5_CTX*)
 *   MD5Update(MD5_CTX*, unsigned char*, unsigned int)
 *   MD5Final(MD5_CTX*, unsigned char*)
 *   MD5Transform(unsigned int*, unsigned char*)
 *   MD5Encode(unsigned char*, unsigned int*, unsigned int)
 *   MD5Decode(unsigned int*, unsigned char*, unsigned int)
 *   byteToHexString(unsigned char*, int, char*)
 *
 * The JNI entry getSecret likely does:
 *   1. Verify APK signature (we skip this)
 *   2. Compute signature from input params
 *   3. Return hex string
 *
 * Strategy: call encrypt + MD5 + byteToHexString directly
 */

typedef struct {
    unsigned int state[4];
    unsigned int count[2];
    unsigned char buffer[64];
} MD5_CTX;

typedef void (*fn_encrypt)(char *output, char *input, int len);
typedef void (*fn_decrypt)(char *output, char *input, int len);
typedef void (*fn_MD5Init)(MD5_CTX *ctx);
typedef void (*fn_MD5Update)(MD5_CTX *ctx, unsigned char *input, unsigned int len);
typedef void (*fn_MD5Final)(MD5_CTX *ctx, unsigned char *digest);
typedef void (*fn_byteToHexString)(unsigned char *input, int len, char *output);

static void dump_hex(const char *label, const unsigned char *data, int len) {
    printf("%s (%d bytes): ", label, len);
    for (int i = 0; i < len && i < 64; i++) {
        printf("%02x", data[i]);
    }
    if (len > 64) printf("...");
    printf("\n");
}

static char *do_md5_hex(void *handle, const unsigned char *data, int len) {
    fn_MD5Init md5_init = (fn_MD5Init)dlsym(handle, "_Z7MD5InitP7MD5_CTX");
    fn_MD5Update md5_update = (fn_MD5Update)dlsym(handle, "_Z9MD5UpdateP7MD5_CTXPhj");
    fn_MD5Final md5_final = (fn_MD5Final)dlsym(handle, "_Z8MD5FinalP7MD5_CTXPh");
    fn_byteToHexString to_hex = (fn_byteToHexString)dlsym(handle, "_Z15byteToHexStringPhiPc");

    if (!md5_init || !md5_update || !md5_final || !to_hex) {
        fprintf(stderr, "Failed to load MD5 functions\n");
        return NULL;
    }

    MD5_CTX ctx;
    unsigned char digest[16];
    md5_init(&ctx);
    md5_update(&ctx, (unsigned char *)data, len);
    md5_final(&ctx, digest);

    dump_hex("MD5 digest", digest, 16);

    static char hex[33];
    memset(hex, 0, sizeof(hex));
    to_hex(digest, 16, hex);
    return hex;
}

int main(int argc, char **argv) {
    printf("=== JavDB libsecurity.so Analysis ===\n\n");

    void *handle = dlopen("./libsecurity.so", RTLD_NOW);
    if (!handle) {
        fprintf(stderr, "dlopen failed: %s\n", dlerror());
        fprintf(stderr, "Trying with RTLD_LAZY...\n");
        handle = dlopen("./libsecurity.so", RTLD_LAZY);
        if (!handle) {
            fprintf(stderr, "dlopen LAZY also failed: %s\n", dlerror());
            return 1;
        }
    }
    printf("Library loaded successfully.\n\n");

    /* Test 1: MD5 of known string to verify MD5 implementation works */
    printf("--- Test 1: MD5 verification ---\n");
    const char *test_str = "hello";
    char *md5_hex = do_md5_hex(handle, (const unsigned char *)test_str, strlen(test_str));
    if (md5_hex) {
        printf("MD5(\"%s\") = %s\n", test_str, md5_hex);
        printf("Expected:    5d41402abc4b2a76b9719d911017c592\n");
        printf("Match: %s\n\n", strcmp(md5_hex, "5d41402abc4b2a76b9719d911017c592") == 0 ? "YES" : "NO");
    }

    /* Test 2: Try the encrypt function */
    printf("--- Test 2: encrypt function ---\n");
    fn_encrypt enc = (fn_encrypt)dlsym(handle, "_Z7encryptPcS_i");
    fn_decrypt dec = (fn_decrypt)dlsym(handle, "_Z7decryptPcS_i");

    if (enc) {
        /* The keyAmplitude from config is "lksjfkdsjfkdsfjkld" */
        char input[256];
        char output[256];
        memset(input, 0, sizeof(input));
        memset(output, 0, sizeof(output));

        /* Try encrypting a test string */
        strncpy(input, "STARS-001", 255);
        enc(output, input, strlen(input));
        dump_hex("encrypt(\"STARS-001\")", (unsigned char *)output, 32);

        /* Try with key-like input */
        memset(input, 0, sizeof(input));
        memset(output, 0, sizeof(output));
        strncpy(input, "astarte", 255);
        enc(output, input, strlen(input));
        dump_hex("encrypt(\"astarte\")", (unsigned char *)output, 32);

        /* Try decrypt of known data */
        if (dec) {
            char decrypted[256];
            memset(decrypted, 0, sizeof(decrypted));
            dec(decrypted, output, 32);
            printf("decrypt back: \"%s\"\n", decrypted);
        }
    } else {
        printf("encrypt function not found\n");
    }

    /* Test 3: Attempt to reconstruct signature logic */
    printf("\n--- Test 3: Signature reconstruction attempt ---\n");
    printf("Attempting: MD5(encrypt(params + key))\n");

    if (enc) {
        /* Typical params: timestamp + path + key */
        char params[512];
        memset(params, 0, sizeof(params));
        snprintf(params, sizeof(params), "%s%s%s", "/api/v2/search", "q=STARS-001", "astarte");

        char encrypted[512];
        memset(encrypted, 0, sizeof(encrypted));
        enc(encrypted, params, strlen(params));
        dump_hex("encrypt(params)", (unsigned char *)encrypted, 32);

        /* MD5 of the encrypted data - but we need to know the length */
        char *sig = do_md5_hex(handle, (unsigned char *)encrypted, 16);
        if (sig) {
            printf("MD5(encrypt(params))[16] = %s\n", sig);
        }

        sig = do_md5_hex(handle, (unsigned char *)encrypted, 32);
        if (sig) {
            printf("MD5(encrypt(params))[32] = %s\n", sig);
        }

        /* Also try: MD5 of raw params */
        sig = do_md5_hex(handle, (unsigned char *)params, strlen(params));
        if (sig) {
            printf("MD5(raw_params) = %s\n", sig);
        }
    }

    /* Test 4: Try decrypting the data.txt content */
    printf("\n--- Test 4: Attempt to decrypt data.txt ---\n");
    if (dec) {
        /* data.txt is base64 encoded, let's see what the raw encrypted form looks like */
        printf("data.txt appears to be base64-encoded encrypted config.\n");
        printf("Would need base64 decode first, then decrypt.\n");
    }

    /* Test 5: Look for hardcoded keys in the PADDING global */
    printf("\n--- Test 5: PADDING global ---\n");
    unsigned char *padding = (unsigned char *)dlsym(handle, "PADDING");
    if (padding) {
        dump_hex("PADDING", padding, 64);
    } else {
        printf("PADDING symbol not accessible via dlsym\n");
    }

    dlclose(handle);
    printf("\n=== Analysis complete ===\n");
    return 0;
}
