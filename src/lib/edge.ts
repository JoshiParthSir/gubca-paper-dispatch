import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Invokes an edge function and turns failures into readable errors.
// supabase.functions.invoke only reports "Edge Function returned a non-2xx
// status code"; the real message is in the response body.
export async function callEdgeFunction<T = Record<string, unknown>>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      let message = error.message;
      try {
        const payload = await error.context.json();
        message = payload?.error || payload?.message || message;
      } catch {
        // response body was not JSON
      }
      throw new Error(message);
    }
    if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
      throw new Error('Could not reach the server. Please check your connection and try again.');
    }
    throw new Error(error.message);
  }

  if (data?.error) throw new Error(data.error);
  return data as T;
}
