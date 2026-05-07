package api.v1.tm.dtos.responses;

import java.io.Serial;
import java.io.Serializable;

import io.quarkus.runtime.annotations.RegisterForReflection;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@RegisterForReflection
public class ResponseArray<T> implements Serializable{
    @Serial
    private static final long serialVersionUID = 1L;
    private String msg;
    private Integer code;
    private T data;
    
}

